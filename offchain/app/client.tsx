"use client";

import dynamic from "next/dynamic";

const Home = dynamic(() => import("@/app/home"), { ssr: false });

export default function Client() {
    return <Home />;
}