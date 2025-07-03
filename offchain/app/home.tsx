import { useEffect, useState } from "react";
import WalletConnector from "../components/WalletConnector";
import Dashboard from "../components/Dashboard";
import { Address, Koios, Lucid, LucidEvolution, Null, UTxO } from "@lucid-evolution/lucid";
import { Wallet } from "../types/cardano";
import { Button } from "@heroui/button";
import { Blockfrost } from "@lucid-evolution/lucid";

export default function Home() {
    const [lucid, setLucid] = useState<LucidEvolution | null>(null);
    const [address, setAddress] = useState<Address>("");
    const [balance, setBalance] = useState<string>("");
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [showWalletDashboard, setShowWalletDashboard] = useState<boolean>(false);
    const [result, setResult] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [utxos, setUtxos] = useState<UTxO[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Helper-Funktion, um die Adresse zu kürzen
    function formatAddress(address: string): string {
        if (address.length <= 10) return address;
        return `${address.slice(0, 5)}.....${address.slice(-5)}`;
    }

    const blockfrostApiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;

    useEffect(() => {
        if (!blockfrostApiKey) {
            console.error("Blockfrost API Key is missing!");
            setError("Missing API Key. Please check environment variables.");
            return;
        }

        Lucid(
            new Blockfrost("https://cardano-preview.blockfrost.io/api/v0", blockfrostApiKey),
            "Preprod"
        )
            .then(setLucid)
            .catch((err) => {
                console.error("Lucid initialization error:", err);
                setError("Failed to initialize Lucid. Please try again later.");
            });
    }, []);

    async function onConnectWallet(wallet: Wallet) {
        try {
            if (!lucid) throw new Error("Uninitialized Lucid");
            setLoading(true);
            setError(null);

            const api = await wallet.enable();
            lucid.selectWallet.fromAPI(api);
            const walletAddress = await lucid.wallet().address();
            setAddress(walletAddress);

            try {
                const fetchedUtxos = await lucid.wallet().getUtxos();
                setUtxos(fetchedUtxos); // Update UTXOs state
                // calc total summ in wallet
                const totalLovelace: bigint = fetchedUtxos.reduce((acc, utxo) => {
                    const lovelace: bigint = BigInt(utxo.assets?.lovelace ?? 0);
                    return acc + lovelace;
                }, 0n);

                const adaBalance = Number(totalLovelace) / 1_000_000
                setBalance(adaBalance.toString());
            } catch (balanceError) {
                //... error handling
                console.error("Error fetching balance:", balanceError);
                setBalance("Error fetching balance");
                setError("Unable to fetch balance. Please try again.");
            }
            setIsConnected(true);
            setShowWalletDashboard(false);
        } catch (error) {
            console.error("Wallet connection error:", error);
            setError("Failed to connect wallet. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    function disconnectWallet() {
        setAddress("");
        setBalance("");
        setIsConnected(false);
        setError(null); // Clear any errors on disconnect
    }

    return (
        <div className="flex justify-center overflow-hidden">
            <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                {isConnected && (
                    <div className="flex items-center justify-center bg-orange-500 text-white shadow-lg rounded-lg px-4 py-3 font-mono min-w-[20ch]">
                        <div className="text-xs">{formatAddress(address)} {parseFloat(balance).toFixed(2)}<span>₳</span></div>
                    </div>
                )}
                {!isConnected ? (
                    <Button onPress={() => setShowWalletDashboard(!showWalletDashboard)} className="bg-orange-600 text-white shadow-lg">
                        {loading ? "Connecting..." : "Connect Wallet"}
                    </Button>
                ) : (
                    <Button onPress={disconnectWallet} className="bg-orange-600 text-white shadow-lg">
                        Disconnect
                    </Button>
                )}
            </div>

            {error && <div className="text-red-500">{error}</div>} {/* Display error message */}

            {
                lucid ? (
                    address ? (
                        // Wallet verbunden: Dashboard anzeigen
                        <>
                            <Dashboard address={address} lucid={lucid} onError={console.error} />
                        </>
                    ) : (
                        // Keine Wallet verbunden: Wallet-Liste anzeigen
                        showWalletDashboard && <WalletConnector onConnectWallet={onConnectWallet} />
                    )
                ) : (
                    <span className="uppercase">Initializing Lucid</span>
                )
            }

            <span className="font-mono break-words whitespace-pre-wrap">{result}</span>
        </div >
    );
}