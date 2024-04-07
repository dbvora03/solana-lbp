import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("liquidity-bootstrap-pool-factory", () => {
    const SOL = new anchor.BN(1_000_000_000);
    const ONE_DAY = new anchor.BN(86400);
    const TWO_DAYS = new anchor.BN(172800);
    const BN_2 = new anchor.BN(2);
    const BN_256 = new anchor.BN(256);
    const BN_0 = new anchor.BN(0);
    const BN_1 = new anchor.BN(1);

    const now = new anchor.BN(Math.floor(Date.now() / 1000));
    const saleStart = now.add(ONE_DAY);
    const saleEnd = now.add(TWO_DAYS);

    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;

    const depositor = anchor.web3.Keypair.generate();
    const virtualAssets = new anchor.BN(SOL.mul(new anchor.BN(1000)));
    const virtualShares = new anchor.BN(SOL.mul(new anchor.BN(1000)));
    const maxSharePrice = new anchor.BN(SOL.mul(new anchor.BN(10_000)));
    // const maxSharesOut = BN_2.pow(BN_256).sub(new anchor.BN(1)); // type(uint256).max
    const maxSharesOut = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const maxAssetsIn = new anchor.BN(0);
    const weightStart = SOL.div(new anchor.BN(2));
    const weightEnd = SOL.div(new anchor.BN(2));
    const sellingAllowed = true;
    const initialShareAmount = SOL.mul(new anchor.BN(1000));
    const initialAssetAmount = SOL.mul(new anchor.BN(1000));

    let poolAssetKp;
    let poolShareKp;

    let assetMint;
    let shareMint;
    let depositorAssetTokenAccount;
    let depositorShareTokenAccount;
    let lbpManagerPda;

    const fund = async (pubkey) => {
        const airdropSignature = await provider.connection.requestAirdrop(
          pubkey,
          2000 * 1_000_000_000
        );
  
        const latestBlockHash = await provider.connection.getLatestBlockhash();
  
        await provider.connection.confirmTransaction({
          blockhash: latestBlockHash.blockhash,
          lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
          signature: airdropSignature,
        });
    };

    const get_pool_account_address = async (poolId) => {
        let [pool_account_address] = anchor.web3.PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode("pool"),
                lbpManagerPda.toBuffer(),
                assetMint.toBuffer(),
                shareMint.toBuffer(),
                poolId.toArrayLike(Buffer, "le", 8),
            ],
            program.programId
        );
        return pool_account_address;
    }

    before(async () => {
        [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [
              anchor.utils.bytes.utf8.encode("lbp-manager"),
              new anchor.BN(1).toArrayLike(Buffer, "le", 8),
            ],
            program.programId
          );

        const fee_recipient = provider.wallet.publicKey;
    
        let tx = await program.methods
          .initialize(
            new anchor.BN(1),
            fee_recipient,
            new anchor.BN(1000000000),
            new anchor.BN(1000000000),
            new anchor.BN(1000000000)
          )
          .accounts({
            authority: fee_recipient,
            lbpManagerInfo: lbpManagerPda,
          })
          .rpc();
        })

    beforeEach(async () => {
        assetMint = await splToken.createMint(
            provider.connection,
            (provider.wallet as NodeWallet).payer,
            provider.wallet.publicKey,
            null,
            6
        );
        shareMint = await splToken.createMint(
            provider.connection,
            (provider.wallet as NodeWallet).payer,
            provider.wallet.publicKey,
            provider.wallet.publicKey,
            6
        );
        depositorAssetTokenAccount =
            await splToken.createAssociatedTokenAccount(
                provider.connection,
                (provider.wallet as NodeWallet).payer,
                assetMint,
                depositor.publicKey
            );
        depositorShareTokenAccount =
            await splToken.createAssociatedTokenAccount(
                provider.connection,
                (provider.wallet as NodeWallet).payer,
                shareMint,
                depositor.publicKey
            );

        await splToken.mintTo(
            provider.connection,
            (provider.wallet as NodeWallet).payer,
            assetMint,
            depositorAssetTokenAccount,
            (provider.wallet as NodeWallet).payer.publicKey,
            1000_000_000_000
          );
        await splToken.mintTo(
            provider.connection,
            (provider.wallet as NodeWallet).payer,
            shareMint,
            depositorShareTokenAccount,
            (provider.wallet as NodeWallet).payer.publicKey,
            1000_000_000_000
        );

        await fund(depositor.publicKey);

        poolAssetKp = anchor.web3.Keypair.generate();
        poolShareKp = anchor.web3.Keypair.generate();
    });

    it("should create vesting pool", async () => {   
        const poolId = new anchor.BN(1);
        const pool_account_address = await get_pool_account_address(poolId);
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
            weightEnd,
            saleStart,
            saleEnd,
            vestCliff,
            vestEnd,
            sellingAllowed,
        };
        await program.methods.createPool(
            poolSettings,
            poolId,
            initialShareAmount,
            initialAssetAmount,
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
        .signers([depositor, poolAssetKp, poolShareKp])
        .rpc()
    });

    it("should create no vesting pool", async () => {
        const poolId = new anchor.BN(2);
        const pool_account_address = await get_pool_account_address(poolId);
        let vestCliff = BN_0;
        let vestEnd = BN_0;
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
            weightEnd,
            saleStart,
            saleEnd,
            vestCliff,
            vestEnd,
            sellingAllowed,
        };
        await program.methods.createPool(
            poolSettings,
            poolId,
            initialShareAmount,
            initialAssetAmount,
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
        .signers([depositor, poolAssetKp, poolShareKp])
        .rpc()
    });

    it("should createt vesting pool invalid vest cliff", async () => {
        const poolId = new anchor.BN(3);
        const pool_account_address = await get_pool_account_address(poolId);
        let vestCliff = saleEnd.sub(BN_1);
        let vestEnd = saleEnd.add(BN_1);
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
            weightEnd,
            saleStart,
            saleEnd,
            vestCliff,
            vestEnd,
            sellingAllowed,
        };
        try {
            await program.methods.createPool(
                poolSettings,
                poolId,
                initialShareAmount,
                initialAssetAmount,
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
            .signers([depositor, poolAssetKp, poolShareKp])
            .rpc()
        } catch (error) {
            expect(error.error.errorMessage).to.equal("Invalid Vest Cliff");
        }
    });
});