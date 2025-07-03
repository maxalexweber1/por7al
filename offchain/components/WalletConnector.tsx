import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import { Wallet } from "../types/cardano";

export default function WalletConnectors(props: { onConnectWallet: (wallet: Wallet) => Promise<void> }) {
    const { onConnectWallet } = props;

    const [wallets, setWallets] = useState<Wallet[]>();

    useEffect(() => {
        const wallets: Wallet[] = [];

        const { cardano } = window;

        for (const c in cardano) {
            const wallet = cardano[c];

            if (!wallet.apiVersion) continue; // skip
            wallets.push(wallet);
        }

        wallets.sort((l: Wallet, r: Wallet) => {
            return l.name.toUpperCase() < r.name.toUpperCase() ? -1 : 1;
        });
        setWallets(wallets);
    }, []);

    if (!wallets) return <span className="uppercase">Browsing Cardano Wallets</span>;

    if (!wallets.length) return <span className="uppercase">No Cardano Wallet</span>;

    return (
        <div className="absolute right-5
         top-20 flex flex-col gap-2 min-w-[13ch]">
            {wallets.map((wallet, w) => (
                <Button
                    key={`wallet.${w}`}
                    onPress={() => onConnectWallet(wallet)}
                    className="bg-orange-600 text-white shadow-lg capitalize">
                    {wallet.name}
                </Button>
            ))}
        </div>
    );
}