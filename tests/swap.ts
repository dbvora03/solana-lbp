import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";

import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

describe("swap", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();

  anchor.setProvider(provider);

  const program = anchor.workspace
    .LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;

  it("swaps exact assets for shares", async () => {
    // go to sale start
    const sharesOut = 1 * 10 ** 6;
    const maxAssetsIn = program.methods.previewAssetsIn(sharesOut);
  });
});
