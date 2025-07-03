use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference, Transaction}
use cocktail.{key_signed, valid_after}

pub type TimeLock_Datum {
  timelock: Int,
  owner: VerificationKeyHash,
}

validator nft_timelock {
  spend(
    datum_lock: Option<TimeLock_Datum>,
    _redeemer: Data,
    _utxo: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_lock
    and {
      key_signed(tx.extra_signatories, datum.owner),
      valid_after(tx.validity_range, datum.timelock),
    }
  }

  else(_) {
    fail
  }
}
