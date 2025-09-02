import {
    Transaction,
    MeshWallet,
    BlockfrostProvider,
    resolveStakeKeyHash,
} from '@meshsdk/core';

import {
    BaseAddress,
    ScriptHash,
    StakeCredential,
    Ed25519KeyHash,
    PlutusData,
} from "@emurgo/cardano-serialization-lib-nodejs";

import readline from 'node:readline/promises';

import { stdin as input, stdout as output } from 'node:process';

import { blake2b } from "blakejs";

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const provider = new BlockfrostProvider(
    process.env.BLOCKFROST_PROJECT_ID!
);

// change to policy id of an NFT you want to lock 
const policy_id = 'def68337867cb4f1f95b6b811fedbfcdd7780d10a95cc072077088ea';

// script from /validators/everlock.ak
const spend4EverLockScript = "588501010029800aba2aba1aab9faab9eaab9dab9a48888896600264653001300700198039804000cc01c0092225980099b8748008c01cdd500144c8cc896600266e1d2000300a375400d13232598009808001452845900e1bae300e001300b375400d16402460160026016601800260106ea800a2c8030600e00260066ea801e29344d9590011";

// build wallet  MNEMONIC musst be set in .env.local file
const wallet = new MeshWallet({
    networkId: 0, // 0: preview/testnet, 1: mainnet
    fetcher: provider,
    submitter: provider,
    key: {
        type: "mnemonic",
        words: process.env.MNEMONIC!.split(" "),
    },
});

function banner(): void {
    const ORANGE = '\x1b[38;5;208m';
    const RESET = '\x1b[0m';
    const lines = [
        '██████   █████  ██████  ███████ ███████ ██     ',
        '██   ██ ██   ██ ██   ██      ██ ██   ██ ██     ',
        '██   ██ ██   ██ ██   ██     ██  ██   ██ ██     ',
        '██████  ██   ██ ██████     ██   ███████ ██     ',
        '██      ██   ██ ██  ██    ██    ██   ██ ██     ',
        '██       █████  ██   ██  ██     ██   ██ ██████ ',
    ];
    console.log();
    for (const line of lines) console.log(ORANGE + line + RESET);
    console.log();
}

// ask for user input
async function askQuestion(prompt: string): Promise<string> {
    const rl = readline.createInterface({ input, output });
    try {
        return (await rl.question(prompt)).trim();
    } finally {
        rl.close();
    }
}

// String to Hex
function toHex(str: string): string {
    return Array.from(str).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
}

// find Utxo with assetName
async function findUtxoByAssetId(assetId: string) {
    const utxos = await wallet.getUtxos();
    return utxos.find(utxo => utxo.output.amount.some(a => a.unit === assetId));
}

// function to calc lock adress from script & stake address 
function scriptAddressWithStake(
    scriptHex: string,
    stakeAddr: string,
    networkId: number
): string {
    // calc script address 
    const scriptBytes = Buffer.from(scriptHex, "hex");
    const scriptHashBytes = blake2b(scriptBytes, undefined, 28);
    const paymentCred = StakeCredential.from_scripthash(
        ScriptHash.from_bytes(scriptHashBytes)
    );

    // stakeKeyHash from Stake-Address
    const stakeKeyHashHex = resolveStakeKeyHash(stakeAddr);
    const stakeCred = StakeCredential.from_keyhash(
        Ed25519KeyHash.from_bytes(Buffer.from(stakeKeyHashHex, "hex"))
    );

    // combine to base address and retrun
    const baseAddr = BaseAddress.new(networkId, paymentCred, stakeCred);
    return baseAddr.to_address().to_bech32();
}

// build datum for node
function datumFromSecretNote(note: string): string {
    const pd = PlutusData.new_bytes(Buffer.from(note, "utf8"));
    return Buffer.from(pd.to_bytes()).toString("hex");
}

// ask for node
async function askSecretNote(): Promise<string> {
    return await askQuestion("Enter secret note for datum: ");
}

// build and submit tx
async function buildAndMaybeSubmitLockTx(
    lockAddress: string,
    assetId: string,
    datumHex: string
) {
    const tx = new Transaction({ initiator: wallet })
        .sendAssets(
            { address: lockAddress, datum: { value: datumHex, inline: true } },
            [{ unit: assetId, quantity: "1" }]
        )
        .sendLovelace(
            { address: lockAddress, datum: { value: datumHex, inline: true } },
            "1500000"
        )
        .setChangeAddress(await wallet.getChangeAddress());

    const unsigned = await tx.build();
    console.log("TX built (CBOR bytes):", unsigned.length);

    // confirm
    const ok = (await askQuestion("Submit transaction? (y/n): ")).toLowerCase();
    if (ok !== "y") {
        console.log("Cancelled");
        return;
    }

    const signed = await wallet.signTx(unsigned);
    const txHash = await wallet.submitTx(signed);
    console.log("TX Submitted:", txHash);
}

// main function
async function main(): Promise<void> {
    banner();
    try {
        const changeAddr = await wallet.getChangeAddress();
        if (!changeAddr) {
            console.log('Wallet not connected');
            return;
        }
        console.log('Wallet connected');
        console.log('Wallet Address:', changeAddr);

        const assetName = await askQuestion('Enter PROPHE7 Name: ');
        const assetId = policy_id + toHex(assetName);
        console.log('Asset_ID:', assetId);

        const nftUtxo = await findUtxoByAssetId(assetId);
        if (!nftUtxo) {
            console.log('NFT not found in wallet');
            return;
        }
        console.log('PROPHE7 found in wallet');

        // ask for stake address 
        const stakeAddr = await askQuestion('Enter stake address to lock on: ');
        if (!stakeAddr.startsWith('stake')) {
            console.error("Please provide a valid stake address (starts with 'stake').");
            return;
        }

        // print out lock address 
        const lockAddress = scriptAddressWithStake(spend4EverLockScript, stakeAddr, 0);
        console.log('Calculated Lock Address:', lockAddress);

        const note = await askSecretNote();
        if (!note) {
            console.error("Empty note not allowed.");
            return;
        }
        const datumHex = datumFromSecretNote(note);
        console.log("Datum (CBOR hex):", datumHex);

        await buildAndMaybeSubmitLockTx(lockAddress, assetId, datumHex);

    } catch (err: any) {
        console.error('Wallet connection failed:', err.message || err);
    }
}

main();
