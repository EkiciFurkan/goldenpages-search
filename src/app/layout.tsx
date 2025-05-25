import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "GoldenPages.io",
	description: "Şirket Arama Sayfası",
	icons: {
		icon: [
			{ url: 'favicon.jpeg' },
			{ url: 'favicon.jpeg', type: 'image/png' },
		],
		apple: [
			{ url: 'favicon.jpeg' },
		],
	}
};

export default function RootLayout({
									   children,
								   }: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
		<head>
			<link rel="icon" href="/favicon.jpeg" sizes="any"/>
		</head>
		<body
			className={`${geistSans.variable} ${geistMono.variable} antialiased`}
		>
		{children}
		</body>
		</html>
	);
}
