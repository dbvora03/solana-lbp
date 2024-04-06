import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert } from "chai";

describe("liquidity-bootstrap-fjord", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace
    .LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;

  it("Is initialized!", async () => {
    // Add your test here.

    console.log("Starting")

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
    assert.equal(lbpManagerInfo.authority.toString(), "hi");
  });
});
