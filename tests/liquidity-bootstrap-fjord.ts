import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("liquidity-bootstrap-fjord", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace
    .LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;

  it("Is initialized!", async () => {
    // Add your test here.

    const fee_recipient = provider.wallet.publicKey;

    const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("lbp-manager"),
        new anchor.BN(1).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const tx = await program.methods
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

    console.log("Your transaction signature", tx);

    const lbpManagerInfo = await program.account.lbpManagerInfo.fetch(
      lbpManagerPda
    );
    assert.equal(lbpManagerInfo.authority.toString(), fee_recipient.toString());
  });

  it("Creates a pool", async () => {
    const fee_recipient = provider.wallet.publicKey;
    const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        anchor.utils.bytes.utf8.encode("lbp-manager"),
        new anchor.BN(1).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    const depositor = anchor.web3.Keypair.generate();

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

    const poolAssetTokenAccount = await splToken.createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      assetMint,
      lbpManagerPda
    );

    const poolShareTokenAccount = await splToken.createAssociatedTokenAccount(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      shareMint,
      lbpManagerPda
    );

    await splToken.mintTo(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      assetMint,
      depositorAssetTokenAccount,
      (provider.wallet as NodeWallet).payer.publicKey,
      1000000000
    );

    await splToken.mintTo(
      provider.connection,
      (provider.wallet as NodeWallet).payer,
      shareMint,
      depositorShareTokenAccount,
      (provider.wallet as NodeWallet).payer.publicKey,
      2000000000
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

    const tx = await program.methods
      .createPool({
        //TODO: Add in setting variable
      }, 1000000000, 2000000000, 1)
      .accounts({
        depositor: depositor.publicKey,
        assetMint,
        shareMint,
        depositorAccountAsset: depositorAssetTokenAccount,
        depositorAccountShare: depositorShareTokenAccount,
        lbpManagerInfo: lbpManagerPda,
        pool: pool_account_address,
        poolAccountAsset: poolAssetTokenAccount,
        poolAccountShare: poolShareTokenAccount,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      });
  });
});
