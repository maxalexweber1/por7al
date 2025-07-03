// validators/mint_test_nft.ak
use cardano/assets.{PolicyId}
use cardano/transaction.{Transaction}

validator mint_test_nft {
  mint(_redeemer: Data, _policy_id: PolicyId, _tx: Transaction) {
    True
  }

  else(_) {
    fail
  }
}
