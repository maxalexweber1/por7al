import { Button } from "@heroui/button";
import { useState } from "react";
import {
    Address,
    applyDoubleCborEncoding,
    SpendingValidator,
    Constr,
    Data,
    UTxO,
    fromText,
    LucidEvolution,
    validatorToAddress,
    MintingPolicy,
    mintingPolicyToId,
    TxSignBuilder,
    getAddressDetails,
    calculateMinLovelaceFromUTxO,
    PROTOCOL_PARAMETERS_DEFAULT,
    Network,
    credentialToAddress
} from "@lucid-evolution/lucid";

import { toast } from "sonner";

// set scripts from smart contracts
const Script = {
    Spend4EverLockValidator: applyDoubleCborEncoding(
        "588501010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144c8cc896600266e1d2000300a375400d13232598009808001452845900e1bae300e001300b375400d16402460160026016601800260106ea800a2c8030600e00260066ea801e29344d9590011"
    ),

    TestMintValidator: applyDoubleCborEncoding(
        "585401010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748000c01cdd500144c9289bae30093008375400516401830060013003375400d149a26cac8009"
    ),
};


const policyId = "def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea"; // change to org. policy from nfts to lock
const assetNameHex = "303550524f50484537"; // "05PROPHE7" in Hex -> just for testing, need to do this dynamicly 
const assetId = policyId + assetNameHex

// 4 ever lock validator
const everlock_validator: SpendingValidator = {
    type: "PlutusV3",
    script: Script.Spend4EverLockValidator,
};

// test nft minting
const mintValidator: MintingPolicy = {
    type: "PlutusV3",
    script: Script.TestMintValidator,
};


// start of dashboard
export default function Dashboard(props: {
    lucid: LucidEvolution;
    address: Address;
    onError: (error: any) => void;
}) {
    // consts
    const { lucid, onError } = props;

    const [isLockModalOpen, setIsLockModalOpen] = useState(false);
    const [owneraddress, setOwneraddress] = useState("addr1q87xjyd3jdgctjdcs2g22ra7xqqqm4pyc6360tdz3rwmfk5gh9m099xmfh32rem329n8d5js7h4kzedn082hhc482uhs528aqy");
    const [assetPolicyId, setAssetPolicyId] = useState("263eb3e3c980c15305f393dc7a2f6289ba12732b6636efe46d6e2c16")
    const [assetName, setAssetName] = useState("545453547572746c6531303037")
    const [note, setNode] = useState("")

    // submit tx function
    async function submitTx(tx: TxSignBuilder) {
        const txSigned = await tx.sign.withWallet().complete();
        const txHash = await txSigned.submit();
        return txHash;
    }

    async function getLockAddressFromAddress(address: string,
        validator: SpendingValidator,
        network: Network
    ) {
        const addressDetails = getAddressDetails(address);
        const stakeCred = addressDetails.stakeCredential;
        if (!stakeCred) throw new Error("Stake credential not found");
        return validatorToAddress(network, validator, stakeCred);
    }

    // mint test nft
    async function mintTestNFT() {
        try {
            // get all utxos from wallet
            const utxos = await lucid.wallet().getUtxos();
            // get policy id from minting validator
            const policyId = mintingPolicyToId(mintValidator);

            // set test data
            const rawAssetName = "05PROPHE7";
            const assetName = fromText(rawAssetName);
            const assetId = policyId + assetName;

            // build empty redeemer
            const redeemer = Data.to(new Constr(0, [new Constr(0, [])]));

            // set number of assets to be minted 
            const mintedNFT = { [assetId]: 1n };

            // build ta
            const tx = await lucid
                .newTx()
                .collectFrom(utxos)
                .mintAssets(mintedNFT, redeemer)
                .attach.MintingPolicy(mintValidator)
                .attachMetadata(721, {
                    [policyId]: {
                        [assetName]: {
                            name: rawAssetName,
                            image: "https://avatars.githubusercontent.com/u/118294286",
                        },
                    },
                })
                .complete();
            submitTx(tx)
                .then((result) => {

                })

            console.log(`Test NFT successfully minted`);
        } catch (err) {
            console.error("Minting failed:", err);
            throw new Error(`Minting failed: ${err}`);
        }
    }

    function textToHex(text: string) {
        return [...new TextEncoder().encode(text)]
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }

    function hexToText(hex: string) {
        const bytes = hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? [];
        return new TextDecoder().decode(new Uint8Array(bytes));
    }

    async function lock4ever() {
        try {

            const assetId = assetPolicyId + assetName;

            // build the lock address from spending validator and user adress stake cred
            const lockAddress = await getLockAddressFromAddress(owneraddress, everlock_validator, "Mainnet")

            // find nft to lock
            const utxos = await lucid.wallet().getUtxos();

            console.log(utxos);

            // find utxo with nft in it
            const nftUtxo = utxos.find((utxo) => assetId in utxo.assets);

            if (!nftUtxo) {

                toast.error("NFT not found in wallet");
                return;
            }

            // build dummy utxo to calc min ada for lock
            const dummyUtxo: UTxO = {
                txHash: "0".repeat(64),
                outputIndex: 0,
                address: lockAddress,
                assets: { [assetId]: 1n }
            };

            // calc min ada 
            const minAda = calculateMinLovelaceFromUTxO(
                BigInt(PROTOCOL_PARAMETERS_DEFAULT.coinsPerUtxoByte),
                dummyUtxo
            );

            const note_hex = textToHex(note)

            const lock_datum = Data.to(new Constr(0, [note_hex]));

            // build transaction
            const tx = await lucid
                .newTx()
                .collectFrom([nftUtxo])
                .pay.ToContract(lockAddress,
                    {
                        kind: "inline",
                        value: lock_datum
                    }, {
                    [assetId]: 1n,
                    lovelace: minAda,
                })
                .complete();

            // submit transaction
            await submitTx(tx);
            toast.success("Successfully locked");

        } catch (error) {
            onError(error);
            toast.error("Error while locking nft");
        }
    }

    // start of UI 
    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="border-2 border-gray-700 rounded-lg p-8 flex flex-col gap-4 items-center w-full max-w-lg bg-orange-600">
                <span className="text-white capitalize text-lg px-18 py-10 text-center">4EVERPOR7AL</span>
                <div className="flex flex-wrap gap-4 justify-center">
                    <Button
                        className="bg-orange-700 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => setIsLockModalOpen(true)}
                    >
                        LOCK 4 EVER
                    </Button>
                </div>
                {isLockModalOpen && (
                    <div className="fixed inset-0 bg-orange-100 bg-opacity-50 flex items-center justify-center">
                        <div className="bg-orange-500 text-white rounded-lg p-6 w-full max-w-sm">
                            <h2 className="text-xl font-bold mb-4">Lock Details</h2>
                            <input
                                type="string"
                                value={owneraddress}
                                onChange={(e) => setOwneraddress(e.target.value)}
                                placeholder="owner address"
                                className="w-full p-2 border rounded mb-4 text-white"
                            />
                            <input
                                type="string"
                                value={assetPolicyId}
                                onChange={(e) => setAssetPolicyId(e.target.value)}
                                placeholder="Policy Id"
                                className="w-full p-2 border rounded mb-4 text-white"
                            />
                            <input
                                type="string"
                                value={assetName}
                                onChange={(e) => setAssetName(e.target.value)}
                                placeholder="Asset Name"
                                className="w-full p-2 border rounded mb-4 text-white"
                            />
                            <input
                                type="string"
                                value={note}
                                onChange={(e) => setNode(e.target.value)}
                                placeholder="Datum Note"
                                className="w-full p-2 border rounded mb-4 text-white"
                            />
                            <div className="flex gap-4 justify-end">
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => setIsLockModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => lock4ever()}>
                                    Confirm
                                </Button>
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => mintTestNFT()}>
                                    Mint Test NFT
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >

    );
}