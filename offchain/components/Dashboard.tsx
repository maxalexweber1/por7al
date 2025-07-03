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
import { dateInput } from "@heroui/theme";

// set scripts from smart contracts
const Script = {
    SpendTimeLockValidator: applyDoubleCborEncoding(
        "59016201010029800aba2aba1aba0aab9faab9eaab9dab9a488888896600264653001300800198041804800cdc3a400530080024888966002600460106ea800e2646644b30013370e900018059baa0018992cc004c8c8cc004004dd618091809980998099809980998099809980998079baa0072259800800c528456600266e3cdd71809800801c528c4cc008008c05000500e2022375c60206022601a6ea800626464646644b3001300b30113754005159800980598089baa30153016003899b88001375a602a60246ea800a266e24004dd6980a98091baa002404114a08080c04c004dd6980998081baa004330113012001330119800980418071baa30123013001a6103d87a8000a60103d8798000403497ae0300e37546022601c6ea8004c040c044c044c044c044c044c044c044c034dd5002c5282016300f300c3754003164028601a002601a601c00260126ea800e2c8038601000260066ea802229344d95900101"
    ),

    SpendPwLockValidator: applyDoubleCborEncoding(
        "58d401010029800aba2aba1aab9faab9eaab9dab9a488888966002646464b30013370e900118029baa00189919912cc004cdc3a400060106ea8006264b30013232330010013758601c601e601e601e601e601e601e601e601e60186ea8c038024896600200314a115980099b8f375c601e00200714a31330020023010001402c8070dd71806180698051baa001899b8f37246eb8c030018dd7180618051baa0018a504020601660126ea80062c8038c024004c024c028004c018dd5000c5900418039804000980380098019baa0078a4d13656400401"
    ),

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

// time lock validator
const spending_time_validator: SpendingValidator = {
    type: "PlutusV3",
    script: Script.SpendTimeLockValidator,
};

// password lock validator
const spending_pw_validator: SpendingValidator = {
    type: "PlutusV3",
    script: Script.SpendPwLockValidator,
};

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

    const [isTimeLockModalOpen, setIsTimeLockModalOpen] = useState(false);
    const [isPwUnlockModalOpen, setIsPwUnlockModalOpen] = useState(false);
    const [timelock, setTimelock] = useState("");
    const [pwunlock, setUnlockPassword] = useState("");

    // submit tx function
    async function submitTx(tx: TxSignBuilder) {
        const txSigned = await tx.sign.withWallet().complete();
        const txHash = await txSigned.submit();
        return txHash;
    }

    // calculate lock adress from validator and user stake creds
    async function getLockAddressWithStakeCred(
        validator: SpendingValidator,
        network: Network
    ) {
        // get wallet address & details
        const baseAddress = await lucid.wallet().address();
        const addressDetails = getAddressDetails(baseAddress);

        // get stake creds 
        const stakeCred = addressDetails.stakeCredential;
        if (!stakeCred) throw new Error("Stake credential not found");

        // return complete validator adress
        return validatorToAddress(network, validator, stakeCred);
    }

    // calculate sha256 hash for password lock / unlock  function
    async function sha256(message: string) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex;
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

    async function timeLock(timelock: string, assetId: string) {
        try {

            // build lock address from validator address and user wallet stake creds 
            const lockAddress = await getLockAddressWithStakeCred(spending_time_validator, "Preview");

            // find nft to lock
            const utxos = await lucid.wallet().getUtxos();
            console.log(`utxos: `, utxos);

            // find utxo with nft in it
            const nftUtxo = utxos.find((utxo) => assetId in utxo.assets);

            if (!nftUtxo) {
                toast.error("NFT not found in wallet");
                return;
            }

            // get currentSlot 
            const currenttime = (Date.now())

            console.log("currenttime:", currenttime)

            // get lock durration
            const lockDuration = parseInt(timelock);
            // build unlocking slot time
            const unlockSlot = BigInt(currenttime + lockDuration);

            if (!unlockSlot) {

                toast.error("Error with locking Time ");
                return;
            }

            console.log("unlock", unlockSlot);

            // get address details & payment creds 
            const baseAddress = await lucid.wallet().address();
            const addressDetails = getAddressDetails(baseAddress);
            const paymentCred = addressDetails.paymentCredential;

            if (!paymentCred || paymentCred.type !== "Key") throw new Error("No valid key payment credential found");

            // get key hash from payment creds 
            const publicKeyHash = paymentCred.hash;

            // build datum
            const lock_datum = Data.to(new Constr(0, [unlockSlot, publicKeyHash]));

            // build dummy utxo to calc min ada to lock with nft
            const dummyUtxo: UTxO = {
                txHash: "0".repeat(64),
                outputIndex: 0,
                address: lockAddress,
                assets: { [assetId]: 1n },
                datum: lock_datum
            };

            // get min ada 
            const minAda = calculateMinLovelaceFromUTxO(
                BigInt(PROTOCOL_PARAMETERS_DEFAULT.coinsPerUtxoByte),
                dummyUtxo
            );

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
            setIsTimeLockModalOpen(false)

        } catch (error) {
            toast.error("Error while locking");
        }
    }

    async function timeUnlock(assetId: string) {
        try {
            // get lock adress 
            const lockAddress = await getLockAddressWithStakeCred(spending_time_validator, "Preview");

            // get all utxos from script address 
            const utxosAtScript = await lucid.utxosAt(lockAddress);

            // get UTxO with nft
            const lockedUtxo = utxosAtScript.find((utxo) => assetId in utxo.assets);
            if (!lockedUtxo) {
                toast.error("Locked Nft not found");
                return;
            }

            // get payment creds for unlocking
            const baseAddress = await lucid.wallet().address();
            const addressDetails = getAddressDetails(baseAddress);
            const paymentCred = addressDetails.paymentCredential;
            if (!paymentCred || paymentCred.type !== "Key") throw new Error("No valid payment key credential");

            // get currentSlot to set TX time value
            const currentSlot = Number(await lucid.currentSlot());


            console.log(currentSlot)
            console.log(paymentCred.hash)

            console.log("Unlocking with slot:", currentSlot);
            console.log("Datum timelock expected:", Data.from(lockedUtxo.datum!));

            console.log("validFrom", currentSlot - 5, typeof (currentSlot - 5));
            console.log("validTo", currentSlot + 100, typeof (currentSlot + 100));

            console.log(Data.from(lockedUtxo.datum!));

            const s: string = "84055879";
            const numberValue1: number = parseInt(s.slice(1), 10);

            const s2: string = "84055888";
            const numberValue2: number = parseInt(s2.slice(1), 10);


            // build tx 
            const tx = await lucid
                .newTx()
                .collectFrom([lockedUtxo], Data.void())
                .pay.ToAddress(baseAddress, {
                    [assetId]: 1n,
                    lovelace: lockedUtxo.assets.lovelace,
                })
                .attach.SpendingValidator(spending_time_validator)
                .addSignerKey(paymentCred.hash)
                .validFrom(numberValue1)
                .validTo(numberValue2)
                .complete();

            // submit tx 
            await submitTx(tx);
            toast.success("Successfully unlocked");

        } catch (error) {
            onError(error);
            toast.error("Error while unlocking");
        }
    }

    async function pwLock(assetId: string) {
        try {
            // get pw from env
            const password = process.env.MASTER_PW;
            if (!password) throw new Error("No Master Password set");

            // calculate lock address 
            const lockAddress = await getLockAddressWithStakeCred(spending_pw_validator, "Preview");

            // get utxos from wallet
            const utxos = await lucid.wallet().getUtxos();

            // find utxo with right nft
            const nftUtxo = utxos.find((utxo) => assetId in utxo.assets);
            if (!nftUtxo) {

                toast.error("NFT not found in wallet");
                return;
            }

            // calulate hash from master password
            const passwordHash = await sha256(password);

            // get wallet paymentCreds
            const address = await lucid.wallet().address();
            const addressDetails = getAddressDetails(address);
            const paymentCred = addressDetails.paymentCredential;
            if (!paymentCred || paymentCred.type !== "Key") throw new Error("No valid key payment credential found");

            const owner = paymentCred.hash;

            // build datum
            const datum = Data.to(
                new Constr(0, [
                    passwordHash, // unlock_hash
                    owner,        // owner
                ])
            );

            // build dummy UtxO for min ADA
            const dummyUtxo: UTxO = {
                txHash: "0".repeat(64),
                outputIndex: 0,
                address: lockAddress,
                assets: { [assetId]: 1n },
                datum,
            };
            // calc min Ada
            const minAda = calculateMinLovelaceFromUTxO(
                BigInt(PROTOCOL_PARAMETERS_DEFAULT.coinsPerUtxoByte),
                dummyUtxo
            );

            // build tx
            const tx = await lucid
                .newTx()
                .collectFrom([nftUtxo])
                .pay.ToContract(lockAddress, { kind: "inline", value: datum }, {
                    [assetId]: 1n,
                    lovelace: minAda,
                })
                .complete();

            await submitTx(tx);
            toast.success("Successfully pw locked");

        } catch (error) {
            toast.error("Error while locking");

        }
    }

    async function pwUnlock(password: string, assetId: string) {
        try {
            const lockAddress = await getLockAddressWithStakeCred(spending_pw_validator, "Preview");

            // get utxOs at script address
            const utxosAtScript = await lucid.utxosAt(lockAddress);

            // find utxo with locked nft
            const lockedUtxo = utxosAtScript.find((utxo) => assetId in utxo.assets);
            if (!lockedUtxo) {
                toast.error("NFT not found in script address");
                return;
            }

            // build redeemer to unlock
            const rawPassword = fromText(password);
            const redeemer = Data.to(rawPassword);

            // get wallet details and payment creds hash
            const baseAddress = await lucid.wallet().address();
            const addressDetails = getAddressDetails(baseAddress);
            const stakeCred = addressDetails.stakeCredential;
            const paymentCred = addressDetails.paymentCredential;

            if (!stakeCred || !paymentCred || paymentCred.type !== "Key") {
                throw new Error("Invalid wallet credentials");
            }

            // target adress 
            const targetAddress = credentialToAddress("Preview", paymentCred, stakeCred);

            // build tx
            const tx = await lucid
                .newTx()
                .collectFrom([lockedUtxo], redeemer)
                .pay.ToAddress(targetAddress, {
                    [assetId]: 1n,
                    lovelace: lockedUtxo.assets.lovelace,
                })
                .attach.SpendingValidator(spending_pw_validator)
                .addSignerKey(paymentCred.hash)
                .complete();

            await submitTx(tx);
            toast.success("Successfully unlocked");
            setIsPwUnlockModalOpen(false)
        } catch (err) {
            onError(err);
            toast.error("Error while unlocking");
        }
    }

    async function lock4ever(assetId: string) {
        try {

            // build the lock address from spending validator and user adress stake cred
            const lockAddress = await getLockAddressWithStakeCred(everlock_validator, "Preview");

            // find nft to lock
            const utxos = await lucid.wallet().getUtxos();
            console.log(`utxos: `, utxos);

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

            // build transaction with empty datum so it never can be unlocked 
            const tx = await lucid
                .newTx()
                .collectFrom([nftUtxo])
                .pay.ToContract(lockAddress,
                    {
                        kind: "inline",
                        value: Data.to(""),
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
                <span className="text-white capitalize text-lg px-18 py-10 text-center">TESTING</span>
                <div className="flex flex-wrap gap-4 justify-center">
                    <Button
                        className="bg-orange-700 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => mintTestNFT()}
                    >
                        Mint Test NFT
                    </Button>
                </div>
            </div>
            <div className="border-2 border-gray-700 rounded-lg p-8 flex flex-col gap-4 items-center w-full max-w-lg bg-orange-600">
                <span className="text-white capitalize text-lg px-18 py-10 text-center">7IMEPOR7AL</span>
                <div className="flex flex-wrap gap-4 justify-center">
                    <Button
                        className="bg-orange-700 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => setIsTimeLockModalOpen(true)}
                    >
                        LOCK
                    </Button>
                    <Button
                        className="bg-orange-700 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => timeUnlock(assetId)}
                    >
                        UNLOCK
                    </Button>
                </div>
                {isTimeLockModalOpen && (
                    <div className="fixed inset-0 bg-orange-100 bg-opacity-50 flex items-center justify-center">
                        <div className="bg-orange-500 text-white rounded-lg p-6 w-full max-w-sm">
                            <h2 className="text-xl font-bold mb-4">Timelock in Sec</h2>
                            <input
                                type="number"
                                value={timelock}
                                onChange={(e) => setTimelock(e.target.value)}
                                placeholder="Enter time to lock in s"
                                className="w-full p-2 border rounded mb-4 text-white"
                            />
                            <div className="flex gap-4 justify-end">
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => setIsTimeLockModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => timeLock(timelock, assetId)}>
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="border-2 border-gray-700 rounded-lg p-8 flex flex-col gap-4 items-center w-full max-w-lg bg-orange-600">
                <span className="text-white capitalize text-lg px-18 py-10 text-center">PASSWORDPOR7AL</span>
                <div className="flex flex-wrap gap-4 justify-center">
                    <Button
                        className="bg-orange-800 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => pwLock(assetId)}
                    >
                        LOCK
                    </Button>
                    <Button
                        className="bg-orange-700 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => setIsPwUnlockModalOpen(true)}
                    >
                        UNLOCK
                    </Button>
                </div>
                {isPwUnlockModalOpen && (
                    <div className="fixed inset-0 bg-orange-100 bg-opacity-50 flex items-center justify-center">
                        <div className="bg-orange-500 text-white rounded-lg p-6 w-full max-w-sm">
                            <h2 className="text-xl font-bold mb-4">Password for unlock</h2>
                            <input
                                type="number"
                                value={pwunlock}
                                onChange={(e) => setUnlockPassword(e.target.value)}
                                placeholder="Enter pw to unlock"
                                className="w-full p-2 border rounded mb-4 text-white"
                            />
                            <div className="flex gap-4 justify-end">
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => setIsPwUnlockModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button className="bg-orange-700 text-white px-4 py-2 rounded" onPress={() => pwUnlock(pwunlock, assetId)}>
                                    Confirm
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="border-2 border-gray-700 rounded-lg p-8 flex flex-col gap-4 items-center w-full max-w-lg bg-orange-600">
                <span className="text-white capitalize text-lg px-18 py-10 text-center">4EVERPOR7AL</span>
                <div className="flex flex-wrap gap-4 justify-center">
                    <Button
                        className="bg-orange-700 text-white capitalize text-lg px-8 py-4"
                        radius="full"
                        onPress={() => lock4ever(assetId)}
                    >
                        LOCK 4 EVER
                    </Button>
                </div>
            </div>
        </div>
    );
}