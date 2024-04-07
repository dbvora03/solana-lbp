import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("liquidity-bootstrap-pool-factory", async () => {
    const SOL = new anchor.BN(1_000_000_000);
    const ONE_DAY = new anchor.BN(86400);
    const TWO_DAYS = new anchor.BN(172800);
    const BN_2 = new anchor.BN(2);
    const BN_256 = new anchor.BN(256);

    const now = new anchor.BN(Math.floor(Date.now() / 1000));
    const saleStart = now.add(ONE_DAY);
    const saleEnd = now.add(TWO_DAYS);

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;
    
    const assetMint = await splToken.createMint(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        provider.wallet.publicKey,
        null,
        6
    );
    const shareMint = await splToken.createMint(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        provider.wallet.publicKey,
        provider.wallet.publicKey,
        6
    );

    const depositor = anchor.web3.Keypair.generate();
    const virtualAssets = new anchor.BN(SOL.mul(new anchor.BN(1000)));
    const virtualShares = new anchor.BN(SOL.mul(new anchor.BN(1000)));
    const maxSharePrice = new anchor.BN(SOL.mul(new anchor.BN(10_000)));
    const maxSharesOut = BN_2.pow(BN_256).sub(new anchor.BN(1)); // type(uint256).max
    const maxAssetsIn = new anchor.BN(0);
    const weightStart = SOL.div(new anchor.BN(2));
    const weightEnd = SOL.div(new anchor.BN(2));
    const sellingAllowed = true;
    const initialShareAmount = SOL.mul(new anchor.BN(1000));
    const initialAssetAmount = SOL.mul(new anchor.BN(1000));
    const poolId = new anchor.BN(1);

    const depositorAssetTokenAccount =
      await splToken.createAssociatedTokenAccount(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        assetMint,
        depositor.publicKey
      );
    const depositorShareTokenAccount =
      await splToken.createAssociatedTokenAccount(
        provider.connection,
        (provider.wallet as NodeWallet).payer,
        shareMint,
        depositor.publicKey
      );
    
    const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            anchor.utils.bytes.utf8.encode("lbp-manager"),
            new anchor.BN(1).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
    );
    const [pool_account_address] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("pool"),
          lbpManagerPda.toBuffer(),
          assetMint.toBuffer(),
          shareMint.toBuffer(),
        ],
        program.programId
    );
    const poolAssetKp = anchor.web3.Keypair.generate();
    const poolShareKp = anchor.web3.Keypair.generate();

    it("should create vesting pool", async () => {
        const vestCliff = saleEnd.add(ONE_DAY);
        const vestEnd = saleEnd.add(TWO_DAYS);
        const poolSettings = {
            asset: assetMint,
            share: shareMint,
            creator: depositor.publicKey,
            virtualAssets,
            virtualShares,
            maxSharePrice,
            maxSharesOut,
            maxAssetsIn,
            weightStart,
            weightEnd, // Make sure there's a comma here if you add more properties after weightEnd
            saleStart,
            saleEnd,
            vestCliff,
            vestEnd,
            sellingAllowed,
        };
        const tx = await program.methods.createPool(
            poolSettings,
            initialShareAmount,
            initialAssetAmount,
            poolId
        ).accounts({
            depositor: depositor.publicKey,
            assetMint,
            shareMint,
            depositorAccountAsset: depositorAssetTokenAccount,
            depositorAccountShare: depositorShareTokenAccount,
            lbpManagerInfo: lbpManagerPda,
            pool: pool_account_address,
            poolAccountAsset: poolAssetKp.publicKey,
            poolAccountShare: poolShareKp.publicKey,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
    });
});