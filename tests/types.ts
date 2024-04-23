import * as anchor from "@coral-xyz/anchor";

export interface ComputeReservesAndWeightsOutput {
    assetReserve: anchor.BN,
    shareReserve: anchor.BN,
    assetWeight: anchor.BN,
    shareWeight: anchor.BN
}