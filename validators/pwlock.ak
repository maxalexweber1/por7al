use aiken/crypto.{VerificationKeyHash, sha2_256}
use cardano/transaction.{OutputReference, Transaction}
use cocktail.{key_signed}

pub type Redeemer =
  ByteArray

pub type PwLock_Datum {
  unlock_hash: ByteArray,
  owner: VerificationKeyHash,
}

validator nft_hashlock {
  spend(
    datum_lock: Option<PwLock_Datum>,
    redeemer: Redeemer,
    _utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_lock
    let hash_matches = sha2_256(redeemer)
    and {
      key_signed(tx.extra_signatories, datum.owner),
      hash_matches == datum.unlock_hash,
    }
  }

  else(_) {
    fail
  }
}
