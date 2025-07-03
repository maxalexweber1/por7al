use aiken/crypto.{VerificationKeyHash}
// never unlock 
use cardano/transaction.{OutputReference, Transaction}

// 🔧 Eigener Datum-Typ
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

test test1() {
  let owner = #"00000000000000000000000000000000000000000000000000000000"
  let datum = LockDatum { owner }

  let redeemer = LockRedeemer { msg: "Hello" }

  let oref = OutputReference { transaction_id: "", output_index: 0 }

  let tx = Transaction { ..transaction.placeholder, extra_signatories: [] }

  !nft_forever_lock.spend(Some(datum), redeemer, oref, tx)
}
