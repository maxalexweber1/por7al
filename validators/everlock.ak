use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference, Transaction}

pub type LockDatum {
  owner: VerificationKeyHash,
}

pub type LockRedeemer {
  msg: ByteArray,
}

validator nft_forever_lock {
  spend(
    _datum_lock: Option<LockDatum>,
    _redeemer: LockRedeemer,
    _utxo: OutputReference,
    _tx: Transaction,
  ) {
    #[7] == #[0]
  }

  else(_) {
    fail
  }
}
