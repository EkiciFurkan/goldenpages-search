// LocationComponent.tsx

"use client";

import { useState, ReactNode } from 'react';

interface AddressInfo {
	country?: string;
	city?: string;
	district?: string;
	fullAddress?: string;
}

interface LocationComponentProps {
	onAddressFetched: (address: AddressInfo) => void;
	children?: ReactNode;
	showInternalMessages?: boolean;
	buttonClassName?: string;
}

function LocationComponent({
							   onAddressFetched,
							   children,
							   showInternalMessages = false, // Varsayılan olarak iç mesajları gösterme
							   buttonClassName = "p-2.5 rounded-lg border bg-white hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FCA300] transition-colors duration-150"
						   }: LocationComponentProps) {
	const [, setLocation] = useState<GeolocationPosition | null>(null);
	const [address, setAddress] = useState<AddressInfo | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isFetchingAddress, setIsFetchingAddress] = useState<boolean>(false);

	const fetchAddress = async (latitude: number, longitude: number) => {
		setIsFetchingAddress(true);
		setError(null);
		try {
			const response = await fetch(
				`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=tr`
			);
			if (!response.ok) {
				throw new Error(`Adres alınamadı: ${response.statusText} (HTTP ${response.status})`);
			}
			const data = await response.json();

			if (data && data.address) {
				const addr = data.address;
				const fetchedAddressInfo: AddressInfo = {
					country: addr.country,
					city: addr.city || addr.town || addr.village,
					district: addr.city_district || addr.suburb || addr.county || addr.administrative, // İlçe/Bölge için daha fazla seçenek
					fullAddress: data.display_name,
				};
				setAddress(fetchedAddressInfo);
				onAddressFetched(fetchedAddressInfo); // Alınan adresi üst komponente gönder
			} else {
				throw new Error("Adres bilgisi bulunamadı.");
			}
		} catch (err) {
			console.error("Adres alma hatası:", err);
			const errorMessage = err instanceof Error ? err.message : "Adres alınırken bir hata oluştu.";
			setError(errorMessage);
			setAddress(null);
			// Hata durumunda da üst komponente bilgi verilebilir, ancak bu örnekte sadece başarılı sonucu iletiyoruz.
			// onAddressFetched({ error: errorMessage }); gibi bir yapı da kurulabilir.
		} finally {
			setIsFetchingAddress(false);
		}
	};

	const handleGetLocation = () => {
		if (typeof window !== "undefined" && navigator.geolocation) {
			setIsLoading(true);
			setError(null);
			setLocation(null);
			setAddress(null);

			navigator.geolocation.getCurrentPosition(
				(position: GeolocationPosition) => {
					setLocation(position);
					setIsLoading(false);
					fetchAddress(position.coords.latitude, position.coords.longitude);
				},
				(err: GeolocationPositionError) => {
					let errorMessage = "Bilinmeyen bir hata oluştu.";
					switch (err.code) {
						case err.PERMISSION_DENIED:
							errorMessage = "Konum iznini reddettiniz. Lütfen tarayıcı ayarlarından izin verin.";
							break;
						case err.POSITION_UNAVAILABLE:
							errorMessage = "Konum bilgisi şu anda mevcut değil.";
							break;
						case err.TIMEOUT:
							errorMessage = "Konum alma isteği zaman aşımına uğradı.";
							break;
					}
					setError(errorMessage);
					setIsLoading(false);
				},
				{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
			);
		} else {
			setError("Tarayıcınız konum servisini desteklemiyor.");
			setIsLoading(false);
		}
	};

	const renderButtonContent = () => {
		if (isLoading || isFetchingAddress) {
			return (
				<svg className="animate-spin h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			);
		}
		return children || (
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className="text-gray-600"
			>
				<path
					d="M21 10C21 17 12 23 12 23S3 17 3 10C3 5.02944 7.02944 1 12 1C16.9706 1 21 5.02944 21 10Z"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle
					cx="12"
					cy="10"
					r="3"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>
		);
	};

	return (
		<div>
			<button
				type="button"
				onClick={handleGetLocation}
				disabled={isLoading || isFetchingAddress}
				className={buttonClassName}
				title="Konumumu Kullanarak Doldur"
			>
				{renderButtonContent()}
			</button>

			{showInternalMessages && (
				<div className="text-xs mt-1">
					{isLoading && <p>Konum alınıyor...</p>}
					{isFetchingAddress && <p>Adres bilgileri alınıyor...</p>}
					{address && !isFetchingAddress && (
						<div>
							<p>Alınan Adres: {address.city}, {address.country}</p>
						</div>
					)}
					{error && <p className="text-red-600">Hata: {error}</p>}
				</div>
			)}
		</div>
	);
}

export default LocationComponent;