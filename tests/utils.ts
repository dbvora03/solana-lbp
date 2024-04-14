import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert, expect, use } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

export const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;
export const provider = anchor.AnchorProvider.env();

/* constants */

export const SOL = new anchor.BN(1_000_000_000);
export const ONE_DAY = new anchor.BN(86400);
export const TWO_DAYS = new anchor.BN(172800);
export const TEN_DAYS = new anchor.BN(864000);
export const BN_0 = new anchor.BN(0);
export const BN_1 = new anchor.BN(1);
export const defaultInitialShareAmount = SOL.mul(new anchor.BN(1000));
export const defaultInitialAssetAmount = SOL.mul(new anchor.BN(1000));
export const ZERO_ADDRESS = new anchor.web3.PublicKey("11111111111111111111111111111111")

/* Token Utils */

export const createMintAndVault = async(
    amount: anchor.BN,
    owner?: anchor.web3.PublicKey,
    decimals?: number
) => {
    const mint = new anchor.web3.Keypair();
    const vault = new anchor.web3.Keypair();
    const tx = new anchor.web3.Transaction();

    tx.add(
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: mint.publicKey,
          space: 82,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
          programId: splToken.TOKEN_PROGRAM_ID,
        }),
        splToken.createInitializeMintInstruction(
          mint.publicKey,
          decimals ?? 0,
          provider.wallet.publicKey,
          null
        ),
        anchor.web3.SystemProgram.createAccount({
          fromPubkey: provider.wallet.publicKey,
          newAccountPubkey: vault.publicKey,
          space: 165,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(
            165
          ),
          programId: splToken.TOKEN_PROGRAM_ID,
        }),
        splToken.createInitializeAccountInstruction(
          vault.publicKey,
          mint.publicKey,
          owner
        ),
        splToken.createMintToInstruction(
          mint.publicKey,
          vault.publicKey,
          provider.wallet.publicKey,
          amount.toNumber()
        )
    );

    await provider.sendAndConfirm(tx, [mint, vault]);
    return [mint.publicKey, vault.publicKey];
}

export async function createTokenAccountInstrs(
    provider: anchor.AnchorProvider,
    newAccountPubkey: anchor.web3.PublicKey,
    mint: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey,
    lamports?: number

): Promise<anchor.web3.TransactionInstruction[]> {
    if (lamports === undefined) {
      lamports = await provider.connection.getMinimumBalanceForRentExemption(165);
    }
    return [
      anchor.web3.SystemProgram.createAccount({
        fromPubkey: provider.wallet.publicKey,
        newAccountPubkey,
        space: 165,
        lamports,
        programId: splToken.TOKEN_PROGRAM_ID,
      }),
      splToken.createInitializeAccountInstruction(newAccountPubkey, mint, owner),
    ];
}

export async function createTokenAccount(
    provider: anchor.AnchorProvider,
    mint: anchor.web3.PublicKey,
    owner: anchor.web3.PublicKey
): Promise<anchor.web3.PublicKey> {
    const vault = new anchor.web3.Keypair();
    const tx = new anchor.web3.Transaction();
    tx.add(
      ...(await createTokenAccountInstrs(provider, vault.publicKey, mint, owner))
    );
    await provider.sendAndConfirm(tx, [vault]);
    return vault.publicKey;
}

export const fund = async (pubkey) => {
    const airdropSignature = await provider.connection.requestAirdrop(
      pubkey,
      1000 * SOL.toNumber()
    );
    const latestBlockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSignature,
    });
};

export const createVault = async (mint) => {
    return await createTokenAccount(
        provider,
        mint,
        provider.wallet.publicKey
    );
};

/* Pool Utils */

export const getDefaultPoolSettings = async (
    assetMint: anchor.web3.PublicKey,
    shareMint: anchor.web3.PublicKey,
) => {
    let now = new anchor.BN(
      await provider.connection.getBlockTime(
        await provider.connection.getSlot()
      )
    );
    const weightStart = SOL.div(new anchor.BN(2));
    const weightEnd = SOL.div(new anchor.BN(2));
    const saleStart = now.add(ONE_DAY);
    const saleEnd = now.add(TWO_DAYS);
    const sellingAllowed = true;
    const maxSharePrice = new anchor.BN(SOL.mul(new anchor.BN(10_000)));
    const maxSharesOut = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const maxAssetsIn = new anchor.BN(SOL.mul(new anchor.BN(1000_000_000)));
    const vestCliff = now.add(TEN_DAYS); // 10 days later
    const vestEnd = now.add(TEN_DAYS.mul(new anchor.BN(2))); // 20 days later
    const virtualAssets = BN_0;
    const virtualShares = BN_0;
    const poolSettings = {
      asset: assetMint,
      share: shareMint,
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
    return poolSettings;
};

export const initialize = async (
    managerId: anchor.BN,
) => {
    const [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          anchor.utils.bytes.utf8.encode("lbp-manager"),
          managerId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
    );
  
    // initialize pool factory
    const fee_recipient = provider.wallet.publicKey;

    await program.methods
    .initialize(
        managerId,
        fee_recipient,
        new anchor.BN(1000),
        new anchor.BN(1000),
        new anchor.BN(1000)
    )
    .accounts({
        authority: fee_recipient,
        lbpManagerInfo: lbpManagerPda,
    })
    .rpc();
    
    return lbpManagerPda;
}

export const createPool = async (
    poolId: anchor.BN,
    poolSettings: any,
    assetGod: anchor.web3.PublicKey,
    shareGod: anchor.web3.PublicKey,
    lbpManagerPda: anchor.web3.PublicKey,
    assetMint: anchor.web3.PublicKey,
    shareMint: anchor.web3.PublicKey,
    initialShareAmount: anchor.BN = defaultInitialShareAmount,
    initialAssetAmount: anchor.BN = defaultInitialAssetAmount,
) => {

    const pool = anchor.web3.Keypair.generate();
    const assetVault = anchor.web3.Keypair.generate();
    const shareVault = anchor.web3.Keypair.generate();

    const [assetVaultAuthority, assetVaultNonce] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("asset"), pool.publicKey.toBuffer()],
            program.programId
        );
    const [shareVaultAuthority, shareVaultNonce] =
        anchor.web3.PublicKey.findProgramAddressSync(
            [anchor.utils.bytes.utf8.encode("share"), pool.publicKey.toBuffer()],
            program.programId
    );

    await program.methods
        .createPool(
            poolSettings, 
            poolId, 
            initialShareAmount, 
            initialAssetAmount,
            shareVaultNonce,
            assetVaultNonce,
        )
        .accounts({
            pool: pool.publicKey,
            assetVault: assetVault.publicKey,
            shareVault: shareVault.publicKey,
            assetDepositor: assetGod,
            assetDepositorAuthority: provider.wallet.publicKey,
            shareDepositor: shareGod,
            shareDepositorAuthority: provider.wallet.publicKey,
            lbpManagerInfo: lbpManagerPda,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([pool, assetVault, shareVault])
        .preInstructions([
            await program.account.pool.createInstruction(pool),
            ...(await createTokenAccountInstrs(
                provider,
                assetVault.publicKey,
                assetMint,
                assetVaultAuthority
            )),
            ...(await createTokenAccountInstrs(
                provider,
                shareVault.publicKey,
                shareMint,
                shareVaultAuthority
            )),
        ])
        .rpc();
    
    return {
        pool,
        assetVault,
        shareVault,
        assetVaultAuthority,
        shareVaultAuthority,
    }
}

export const getSwapFees = async (lbpManagerPda) => {
    const lbpManagerInfoAccount = await program.account.lbpManagerInfo.fetch(lbpManagerPda);
    return lbpManagerInfoAccount.swapFee;
}

/* Pool Methods */

export const closePool = async (
    pool, 
    assetVault, 
    assetVaultAuthority,
    shareVault, 
    shareVaultAuthority,
    managerShareVault,
    feeShareVault,
    feeAssetVault,
    lbpManagerPda
) => {
    
    await program.methods.close().accounts({
        pool: pool,
        assetVault,
        assetVaultAuthority,
        shareVault,
        shareVaultAuthority,
        managerShareVault,
        feeAssetVault,
        feeShareVault,
        lbpManagerInfo: lbpManagerPda,
        
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc()
};

export const swapExactAssetsForShares = async (
    assetsIn, 
    pool,
    buyer,
    shareVault,
    assetVault,
    depositorAssetVault,
    lbpManagerPda,
    buyerStats

) => {
    let buyEvent = null;
    const id = program.addEventListener("Buy", (event, slot) => {
      buyEvent = event;
    });

    await program.methods
      .swapExactAssetsForShares(buyer.publicKey, assetsIn, BN_0)
      .accounts({
        depositor: buyer.publicKey,
        pool: pool.publicKey,
        lbpManagerInfo: lbpManagerPda,
        poolShareVault: shareVault,
        poolAssetVault: assetVault,
        depositorAssetVault: depositorAssetVault,
        // depositorAssetVaultAuthority,
        buyerStats,

        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    if (buyEvent) {
      program.removeEventListener(id);
      const sharesOut = buyEvent.shares;
      return { sharesOut };
    } else {
      program.removeEventListener(id);
      expect.fail("Buy event not emitted");
    }
};

/* User Utils */

export const createUserStats = async (
    pool: anchor.web3.PublicKey,
    user: anchor.web3.Keypair
) => {
    // const [buyerStatsPda] = anchor.web3.PublicKey.findProgramAddressSync(
    //     [
    //       anchor.utils.bytes.utf8.encode("user_stats"),
    //       pool.toBuffer(),
    //       buyer.toBuffer(),
    //     ],
    //     program.programId
    // );

    const userStats = new anchor.web3.Keypair();

    await program.methods.createUserStats(
        user.publicKey,
    ).accounts({
        userStats: userStats.publicKey,
        pool: pool,
        systemProgram: anchor.web3.SystemProgram.programId,
    }).signers(
        [userStats]
    ).preInstructions(
        [
            await program.account.userStats.createInstruction(userStats)
        ]
    ).rpc();

    return {
        userStats: userStats.publicKey
    }
}

export const createUser = async (
    assetMint: anchor.web3.PublicKey,
    shareMint: anchor.web3.PublicKey,
) => {
    const user = anchor.web3.Keypair.generate();
    await fund(user.publicKey);

    const userAssetVault = await createTokenAccount(
        provider,
        assetMint,
        user.publicKey
    );
    const userShareVault = await createTokenAccount(
        provider,
        shareMint,
        user.publicKey
    );

    // fund token vaults
    const tx = new anchor.web3.Transaction();
    tx.add(
        splToken.createMintToInstruction(
            assetMint,
            userAssetVault,
            provider.wallet.publicKey,
            20_000_000 * SOL.toNumber()
        ),
        splToken.createMintToInstruction(
            shareMint,
            userShareVault,
            provider.wallet.publicKey,
            20_000_000 * SOL.toNumber()
        ),
    )
    await provider.sendAndConfirm(tx, []);

    return {
        user,
        userAssetVault,
        userShareVault
    }
}

/* Test Setup Helpers */

export const getNow = async () => {
    const now = new anchor.BN(
        await provider.connection.getBlockTime(
          await provider.connection.getSlot()
        )
    )   
    return now;
};