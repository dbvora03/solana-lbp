import * as anchor from "@coral-xyz/anchor";
import * as splToken from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { LiquidityBootstrapFjord } from "../target/types/liquidity_bootstrap_fjord";
import { assert, expect } from "chai";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";


describe.only("exp", () => {

    const program = anchor.workspace.LiquidityBootstrapFjord as Program<LiquidityBootstrapFjord>;
    const provider = anchor.AnchorProvider.env();



    const SOL = new anchor.BN(1_000_000_000);
    const ONE_DAY = new anchor.BN(86400);
    const TWO_DAYS = new anchor.BN(172800);
    const TEN_DAYS = new anchor.BN(864000);
    const BN_0 = new anchor.BN(0);
    const BN_1 = new anchor.BN(1);
    const defaultInitialShareAmount = SOL.mul(new anchor.BN(1000));
    const defaultInitialAssetAmount = SOL.mul(new anchor.BN(1000));


    /* this should be removed */
    const creator = anchor.web3.Keypair.generate();


    /* Global Variables */
    let assetMint;
    let shareMint;
    let assetGod;
    let shareGod;

    const managerId = new anchor.BN(8);
    let lbpManagerPda;



    /* utils */
    
    const createMintAndVault = async(
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

    const getDefaultPoolSettings = async () => {
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
          creator: creator.publicKey,
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

    async function createTokenAccountInstrs(
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

    async function createTokenAccount(
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

    const fund = async (pubkey) => {
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

    const initialize = async () => {
        [lbpManagerPda] = anchor.web3.PublicKey.findProgramAddressSync(
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
    }

    const closePool = async (
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

    const swapExactAssetsForShares = async (
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

    const createBuyerStats = async (
        pool: anchor.web3.PublicKey,
        buyer: anchor.web3.PublicKey
    ) => {
        const [buyerStatsPda] = anchor.web3.PublicKey.findProgramAddressSync(
            [
              anchor.utils.bytes.utf8.encode("user_stats"),
              pool.toBuffer(),
              buyer.toBuffer(),
            ],
            program.programId
          );

        return buyerStatsPda
    }

    it.only("should redeem all after vest end", async () => {

        // fund users
        await fund(provider.wallet.publicKey)


        // init manager
        await initialize()

        // prepare accounts
        const decimals = 6;
        [assetMint, assetGod] = await createMintAndVault(
            defaultInitialAssetAmount,
            provider.wallet.publicKey,
            decimals
        );
        [shareMint, shareGod] = await createMintAndVault(
            defaultInitialShareAmount,
            provider.wallet.publicKey,
            decimals
        );

        const buyer = anchor.web3.Keypair.generate();
        await fund(buyer.publicKey);

        const pool = anchor.web3.Keypair.generate();
        const assetVault = anchor.web3.Keypair.generate();
        const shareVault = anchor.web3.Keypair.generate();
        const managerShareVault = await createTokenAccount(
            provider,
            shareMint,
            provider.wallet.publicKey
        );
        const feeAssetVault = await createTokenAccount(
            provider,
            assetMint,
            provider.wallet.publicKey
        );
        const feeShareVault = await createTokenAccount(
            provider,
            shareMint,
            provider.wallet.publicKey
        );
        const redeemRecipientShareVault = await createTokenAccount(
            provider,
            shareMint,
            provider.wallet.publicKey
        );

        
        // create user
        const buyerAssetVault = await createTokenAccount(
            provider,
            assetMint,
            buyer.publicKey
        );
        
        const tx = new anchor.web3.Transaction();
        tx.add(
            splToken.createMintToInstruction(
                assetMint,
                buyerAssetVault,
                provider.wallet.publicKey,
                20_000_000 * SOL.toNumber()
            )
        )
        await provider.sendAndConfirm(tx, []);

        let [assetVaultAuthority, assetVaultNonce] =
            anchor.web3.PublicKey.findProgramAddressSync(
                [anchor.utils.bytes.utf8.encode("asset"), pool.publicKey.toBuffer()],
                program.programId
            );
        let [shareVaultAuthority, shareVaultNonce] =
            anchor.web3.PublicKey.findProgramAddressSync(
                [
                    anchor.utils.bytes.utf8.encode("share"), 
                    pool.publicKey.toBuffer()
                ],
                program.programId
            );

        const poolId = new anchor.BN(801);

        // create pool
        

        const poolSettings = await getDefaultPoolSettings();

        await program.methods
            .createPool(
                poolSettings, 
                poolId, 
                defaultInitialShareAmount, 
                defaultInitialAssetAmount,
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

        
        // swap 

        const buyerStats = new anchor.web3.Keypair();

        await program.methods.createUserStats(
            buyer.publicKey,
        ).accounts({
            userStats: buyerStats.publicKey,
            pool: pool.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        }).signers(
            [buyerStats]
        ).preInstructions(
            [
                await program.account.userStats.createInstruction(buyerStats)
            ]
        ).rpc();


        const assetsIn = SOL;
        const { sharesOut } = await swapExactAssetsForShares(
            assetsIn,
            pool,
            buyer,
            shareVault.publicKey,
            assetVault.publicKey,
            buyerAssetVault,
            lbpManagerPda,
            buyerStats.publicKey
        );
            
        // close the pool
        
        await closePool(
            pool.publicKey,
            assetVault.publicKey,
            assetVaultAuthority,
            shareVault.publicKey,
            shareVaultAuthority,
            managerShareVault,
            feeShareVault,
            feeAssetVault,
            lbpManagerPda
        );

        // redeem
        await program.methods.redeem(
        ).accounts({
            pool: pool.publicKey,
            shareVault: shareVault.publicKey,
            shareVaultAuthority: shareVaultAuthority,
            lbpManagerInfo: lbpManagerPda,
            buyerStats: buyerStats.publicKey,
            recipientShareVault: managerShareVault,
            tokenProgram: splToken.TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
        }).rpc();


    })


})