'use client';

import { useState, useEffect, useMemo } from 'react';
import { JotFormSubmission } from '@/generated/prisma/client'; 
import { getData as getCountryData } from 'country-list';
import dynamic from 'next/dynamic'; 

import LocationComponent from '@/components/LocationComponent';
import JotformChatbotEmbed from "@/components/JotformChatbotEmbed"; 

const Select = dynamic(() => import('react-select'), { ssr: false });

// Tipler
type FormDataType = Record<string, unknown>;

interface AddressInfoForHome {
	country?: string;
	city?: string;
	district?: string;
	fullAddress?: string;
}

// Yardımcı Fonksiyonlar (Dosya içinde veya ayrı bir utils dosyasından import edilebilir)
function slugify(text: string): string {
	if (!text || text === 'N/A') {
		return '';
	}
	const turkishMap: Record<string, string> = {
		'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I',
		'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U'
	};
	let slug = text.toString().toLowerCase().trim();
	if (!slug) {
		return '';
	}
	slug = slug.replace(/[çÇğĞıİöÖşŞüÜ]/g, (match) => turkishMap[match] || match);
	slug = slug.replace(/\s+/g, '-')
		.replace(/[^\w-]+/g, '')
		.replace(/--+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
	return slug;
}

function getFormDataValue(formData: FormDataType | null, key: string, defaultValue: string = 'N/A'): string {
	if (formData && typeof formData === 'object' && key in formData) {
		const value = formData[key];
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'object' && value !== null && key !== 'q108_profilePicture108' && key !== 'q105_telephone105') {
			return JSON.stringify(value);
		}
		if (value !== null && value !== undefined && key !== 'q108_profilePicture108' && key !== 'q105_telephone105') {
			return String(value);
		}
		if (key === 'q105_telephone105' && typeof value === 'object' && value !== null) {
			const phoneData = value as { area?: string; phone?: string; country?: string };
			if (phoneData.country && phoneData.area && phoneData.phone) {
				let countryCode = phoneData.country;
				if (countryCode.startsWith("00")) {
					countryCode = countryCode.substring(2);
				} else if (countryCode.startsWith("0")) {
					countryCode = countryCode.substring(1);
				}
				if (countryCode.startsWith('+')) {
					countryCode = countryCode.substring(1);
				}
				return `+${countryCode} (${phoneData.area}) ${phoneData.phone}`;
			}
			return defaultValue;
		}
	}
	return defaultValue;
}

function getProfilePictureUrl(formData: FormDataType | null, key: string): string | null {
	if (formData && typeof formData === 'object' && key in formData) {
		const widgetDataString = formData[key];
		if (typeof widgetDataString === 'string' && widgetDataString.trim() !== '') {
			try {
				const parsedData = JSON.parse(widgetDataString);
				if (
					parsedData &&
					parsedData.widget_metadata &&
					parsedData.widget_metadata.value &&
					Array.isArray(parsedData.widget_metadata.value) &&
					parsedData.widget_metadata.value.length > 0 &&
					parsedData.widget_metadata.value[0].url
				) {
					const baseUrl = "https://www.jotform.com";
					const imageUrlPath = parsedData.widget_metadata.value[0].url;
					if (imageUrlPath.startsWith('http://') || imageUrlPath.startsWith('https://')) {
						return imageUrlPath;
					}
					return baseUrl + imageUrlPath;
				}
			} catch (e) {
				console.error("Profil resmi JSON parse hatası. Sorunlu string:", widgetDataString, "Hata:", e);
				return null;
			}
		}
	}
	return null;
}

function formatSocialUrl(platform: string, value: string): string {
	if (!value || value.trim() === '' || value === 'N/A') {
		return '#';
	}
	if (value.startsWith('http://') || value.startsWith('https://')) {
		return value;
	}
	const cleanedValue = value.replace('@', '').trim();
	switch (platform.toLowerCase()) {
		case 'instagram':
			return `https://instagram.com/${cleanedValue}`;
		case 'tiktok':
			return `https://www.tiktok.com/@${cleanedValue}`;
		case 'twitter':
			return `https://twitter.com/${cleanedValue}`;
		case 'linkedin':
			return cleanedValue.includes('/') ? `https://www.linkedin.com/${cleanedValue}` : `https://www.linkedin.com/in/${cleanedValue}`;
		case 'facebook':
			return `https://www.facebook.com/${cleanedValue}`;
		default:
			return `https://${cleanedValue}`;
	}
}


export default function Home() {
	const [submissions, setSubmissions] = useState<JotFormSubmission[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [filterText, setFilterText] = useState<string>('');
	const [selectedCountry, setSelectedCountry] = useState<{ value: string; label: string } | null>(null);
	const [filterSector, setFilterSector] = useState<string>('');
	const [filterCity, setFilterCity] = useState<string>('');

	const [isSidebarVisible, setIsSidebarVisible] = useState(false);
	const [areSectorButtonsAnimating, setAreSectorButtonsAnimating] = useState(false);

	// Kenar çubuğu animasyonları için useEffect
	useEffect(() => {
		let buttonsTimerId: NodeJS.Timeout;
		const mainTimerId = setTimeout(() => {
			setIsSidebarVisible(true);
			buttonsTimerId = setTimeout(() => {
				setAreSectorButtonsAnimating(true);
			}, 200);
		}, 100);

		return () => {
			clearTimeout(mainTimerId);
			if (buttonsTimerId) {
				clearTimeout(buttonsTimerId);
			}
		};
	}, []);

	// Ülke seçeneklerini oluştur
	const countryOptions = useMemo(() => {
		const countries = getCountryData();
		const options = countries.map(country => ({value: country.code, label: country.name,}));
		return [{value: '', label: 'Tüm Ülkeler'}, ...options];
	}, []);

	useEffect(() => {
		async function fetchSubmissions(): Promise<void> {
			setLoading(true);
			try {
				const response = await fetch('/api/submissions');
				if (!response.ok) {
					return;
				}
				const data: JotFormSubmission[] = await response.json();
				const sortedData = data.sort((a, b) => {
					const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
					const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
					if (isNaN(dateA) && isNaN(dateB)) {
						return 0
					}
					if (isNaN(dateA)) {
						return 1
					}
					if (isNaN(dateB)) {
						return -1
					}
					return dateB - dateA; 
				});
				setSubmissions(sortedData);
			} catch (e) {
				console.error("Veri çekme hatası:", e);
				setError("Gönderiler yüklenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.");
			} finally {
				setLoading(false);
			}
		}
		fetchSubmissions();
	}, []);

	const uniqueSectors = useMemo(() => {
		if (!submissions || submissions.length === 0) {
			return []
		}
		const allSectors = submissions
			.map(sub => getFormDataValue(sub.formDataJson as FormDataType, 'q45_businessSector'))
			.filter(sector => sector && sector !== 'N/A' && sector.trim() !== '');
		return [...new Set(allSectors)].sort((a, b) => a.localeCompare(b, 'tr', {sensitivity: 'base'}));
	}, [submissions]);

	const filteredSubmissions = submissions.filter((submission: JotFormSubmission): boolean => {
		const formData = submission.formDataJson as FormDataType;
		const firmaAdi = getFormDataValue(formData, 'q5_nameOf', '').toLowerCase();
		const submissionCountryName = getFormDataValue(formData, 'q21_schreibenSie21', '').trim().toLowerCase();
		const businessSector = getFormDataValue(formData, 'q45_businessSector', '').toLowerCase();
		const city = getFormDataValue(formData, 'q91_city', '').toLowerCase();

		const nameFilterPassed = filterText.trim() ? firmaAdi.includes(filterText.trim().toLowerCase()) : true;
		const countryFilterPassed = selectedCountry?.value ? submissionCountryName === selectedCountry.label.toLowerCase() && submissionCountryName !== 'n/a' : true;
		const sectorFilterPassed = filterSector.trim() ? businessSector.includes(filterSector.trim().toLowerCase()) : true;
		const cityFilterPassed = filterCity.trim() ? city.includes(filterCity.trim().toLowerCase()) : true;
		return nameFilterPassed && countryFilterPassed && sectorFilterPassed && cityFilterPassed;
	});

	const anyFilterActive = filterText.trim() || selectedCountry?.value || filterSector.trim() || filterCity.trim();

	const handleAddressFromLocation = (address: AddressInfoForHome) => {
		if (address.city) {
			setFilterCity(address.city);
		}
		if (address.country) {
			const countryNameFromApi = address.country;
			const foundCountryOption = countryOptions.find(
				option => option.label.toLowerCase() === countryNameFromApi.toLowerCase()
			);
			if (foundCountryOption && foundCountryOption.value !== '') {
				setSelectedCountry(foundCountryOption);
			} else {
				console.warn(`Konum servisinden gelen "${countryNameFromApi}" ülkesi seçeneklerde bulunamadı.`);
				// setSelectedCountry(countryOptions[0]); // "Tüm Ülkeler" olarak ayarla veya null
			}
		}
	};

	const SIDEBAR_DESKTOP_WIDTH_CLASS = "md:w-60";
	const MAIN_CONTENT_DESKTOP_ML_CLASS = "md:ml-60";
	const MOBILE_BOTTOM_BAR_HEIGHT_APPROX = "pb-[90px]"; // Yaklaşık mobil alt bar yüksekliği

	if (error && !loading) {
		return (
			<main
				className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 p-4 flex flex-col items-center justify-center text-center">
				<h1 className="text-3xl font-bold text-red-600 mb-2">Bir Sorun Oluştu</h1>
				<p className="text-gray-700 text-lg">{error}</p>
			</main>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
			<aside
				className={`
                fixed z-30
                transition-all duration-500 ease-out transform
                ${isSidebarVisible ? 'opacity-100' : 'opacity-0'}
                bottom-0 left-0 w-full h-auto max-h-[75px]
                bg-slate-100 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.12)]
                p-2 border-t border-slate-200 
                flex items-center flex-col
                ${isSidebarVisible ? 'translate-y-0' : 'translate-y-full'}
                md:top-0 md:bottom-auto md:left-0 md:h-screen ${SIDEBAR_DESKTOP_WIDTH_CLASS}
                md:bg-slate-50 md:shadow-lg md:p-4 md:pt-6 md:border-r md:border-t-0
                md:max-h-none md:overflow-y-auto md:translate-y-0
                ${isSidebarVisible ? 'md:translate-x-0' : 'md:-translate-x-full'}
             `}
			>
				<h3 className="hidden md:block text-xl font-semibold text-gray-800 mb-4 px-2">Popüler Aramalar</h3>
				<nav className="w-full h-full overflow-x-auto md:overflow-x-hidden md:overflow-y-auto custom-scrollbar-thin">
					<ul className="flex flex-row items-center space-x-2 h-full md:flex-col md:items-stretch md:space-x-0 md:space-y-1.5 md:h-auto">
						<li className={`
                        flex-shrink-0 md:flex-shrink-1 transition-all duration-300 ease-out
                        ${areSectorButtonsAnimating
							? 'opacity-100 translate-x-0 md:translate-y-0'
							: 'opacity-0 translate-x-3 md:translate-x-0 md:translate-y-3'
						}`}
							style={{ transitionDelay: areSectorButtonsAnimating ? `0ms` : '0ms' }}
						>
							<button
								onClick={() => setFilterSector('')}
								className={`h-full md:h-auto w-auto md:w-full text-center px-3 py-2 rounded-lg text-xs font-medium 
                                     transition-all duration-150 ease-in-out whitespace-nowrap
                                     md:text-left md:text-sm md:whitespace-normal
                                     ${filterSector === ''
									? 'bg-[#FCA300] text-white shadow-sm'
									: 'text-gray-600 hover:bg-slate-200 active:bg-slate-300'}`}
							>
								Tüm Sektörler
							</button>
						</li>
						{uniqueSectors.map((sector, idx) => (
							<li key={idx} className={`
                            flex-shrink-0 md:flex-shrink-1 transition-all duration-300 ease-out
                            ${areSectorButtonsAnimating
								? 'opacity-100 translate-x-0 md:translate-y-0'
								: 'opacity-0 translate-x-3 md:translate-x-0 md:translate-y-3'
							}`}
								style={{ transitionDelay: areSectorButtonsAnimating ? `${(idx + 1) * 75}ms` : '0ms' }}
							>
								<button
									onClick={() => setFilterSector(sector)}
									className={`h-full md:h-auto w-auto md:w-full text-center px-3 py-2 rounded-lg text-xs font-medium 
                                        transition-all duration-150 ease-in-out truncate
                                        md:text-left md:text-sm 
                                        ${filterSector === sector
										? 'bg-[#FCA300] text-white shadow-sm'
										: 'text-gray-600 hover:bg-slate-200 active:bg-slate-300'}`}
									title={sector}
								>
									{sector}
								</button>
							</li>
						))}
					</ul>
				</nav>
			</aside>

			<div
				className={`flex-grow text-gray-800 ${MOBILE_BOTTOM_BAR_HEIGHT_APPROX} md:pb-0 ${MAIN_CONTENT_DESKTOP_ML_CLASS}`}>


				<main className="p-4 sm:p-6 md:p-8">
					<div className="container mx-auto max-w-5xl">
						<a href="https://goldenpages.io/" className="flex justify-center">
							<img src="img.png" alt="Golden Pages Logo" className="w-64 mb-6 h-auto"/>
						</a>
						<div className="mb-8 text-center">
							<h1 className="text-4xl font-bold text-gray-900 mb-2">Firma Kayıtları</h1>
							<p className="text-lg text-[#FCA300]">En son gönderilere ve filtrelere göz atın.</p>
						</div>

						<div
							className="mb-8 flex flex-col sm:flex-row flex-wrap gap-4 items-center sm:items-stretch justify-center">

							<LocationComponent
								onAddressFetched={handleAddressFromLocation}
								showInternalMessages={false}
								buttonClassName="h-[50px] w-auto px-3 flex items-center justify-center text-gray-600 border border-gray-300 bg-white rounded-lg shadow-sm hover:bg-gray-50 focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out"
							/>
							
							<Select
								instanceId="country-filter-select"
								options={countryOptions}
								value={selectedCountry}
								onChange={(option) => setSelectedCountry(option as {
									value: string;
									label: string
								} | null)}
								isClearable={true}
								isSearchable={true}
								placeholder="Ülkeye göre ara..."
								className="w-full sm:w-auto sm:min-w-[200px] flex-grow text-gray-700"
								styles={{
									control: (base, state) => ({
										...base,
										backgroundColor: '#ffffff',
										borderColor: state.isFocused ? '#FCA300' : '#d1d5db',
										borderRadius: '0.5rem',
										paddingTop: '0.30rem',
										paddingBottom: '0.30rem',
										boxShadow: state.isFocused ? `0 0 0 2px #FCA300` : '0 1px 3px 0 rgba(0,0,0,.05), 0 1px 2px -1px rgba(0,0,0,.05)',
										'&:hover': {borderColor: '#9ca3af'},
										minHeight: '50px',
										height: '50px',
									}),
									singleValue: (base) => ({...base, color: '#1f2937'}),
									placeholder: (base) => ({...base, color: '#6b7280'}),
									input: (base) => ({...base, color: '#1f2937'}),
									menu: (base) => ({...base, backgroundColor: '#ffffff', zIndex: 20}),
									option: (base, state) => ({
										...base,
										backgroundColor: state.isFocused ? '#f3f4f6' : state.isSelected ? '#fed7aa' : '#ffffff',
										color: state.isSelected ? '#9a3412' : '#1f2937',
										'&:active': {backgroundColor: '#fdba74'}
									}),
								}}
							/>

							{/* Şehir Girişi - Temizleme Butonu ile */}
							<div className="relative w-full sm:w-auto sm:min-w-[200px] flex-grow">
								<input
									type="text"
									placeholder="Şehre göre ara..."
									value={filterCity}
									onChange={(e) => setFilterCity(e.target.value)}
									className="w-full bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-lg py-3 px-4 pr-10 shadow-sm focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out text-base h-[50px]"
								/>
								{filterCity && (
									<button
										type="button"
										onClick={() => setFilterCity('')}
										className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
										aria-label="Şehir filtresini temizle"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
											 xmlns="http://www.w3.org/2000/svg">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
												  d="M6 18L18 6M6 6l12 12"></path>
										</svg>
									</button>
								)}
							</div>

						
							<div className="relative w-full sm:w-auto sm:min-w-[200px] flex-grow">
								<input
									type="text"
									placeholder="İş sektörüne göre ara..."
									value={filterSector}
									onChange={(e) => setFilterSector(e.target.value)}
									className="w-full bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-lg py-3 px-4 pr-10 shadow-sm focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out text-base h-[50px]"
								/>
								{filterSector && (
									<button
										type="button"
										onClick={() => setFilterSector('')}
										className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
										aria-label="İş sektörü filtresini temizle"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
											 xmlns="http://www.w3.org/2000/svg">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
												  d="M6 18L18 6M6 6l12 12"></path>
										</svg>
									</button>
								)}
							</div>

							

							<div className="relative w-full sm:w-auto sm:min-w-[200px] flex-grow">
								<input
									type="text"
									placeholder="Firma adına göre ara..."
									value={filterText}
									onChange={(e) => setFilterText(e.target.value)}
									className="w-full bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-lg py-3 px-4 pr-10 shadow-sm focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out text-base h-[50px]"
								/>
								{filterText && (
									<button
										type="button"
										onClick={() => setFilterText('')}
										className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
										aria-label="Firma adı filtresini temizle"
									>
										<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
											 xmlns="http://www.w3.org/2000/svg">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
												  d="M6 18L18 6M6 6l12 12"></path>
										</svg>
									</button>
								)}
							</div>

						
						</div>

						<JotformChatbotEmbed />
						

						{loading ? (
							<div className="text-center py-12">
								<h1 className="text-2xl font-semibold text-gray-600">Şirketler Yükleniyor...</h1>
							</div>
						) : submissions.length === 0 && !anyFilterActive ? (
							<div className="text-center py-12">
								<p className="text-xl text-gray-500">Henüz kaydedilmiş bir gönderi bulunmamaktadır.</p>
							</div>
						) : filteredSubmissions.length === 0 && anyFilterActive ? (
							<div className="text-center py-12">
								<p className="text-xl text-gray-500">
									Aradığınız kriterlere uygun firma bulunamadı. <a
									href="https://www.gelbesayfa.com/firma-ekle/" // Bu linki kontrol edin
									className="font-bold text-[#FCA300] hover:underline" target="_blank"
									rel="noopener noreferrer">Buradan yeni firma ekleyebilirsiniz!</a>
								</p>
							</div>
						) : (
							<>
								<h2 className="text-3xl font-semibold text-gray-900 mb-6 text-left">
									En Son Kayıtlar
									{anyFilterActive && <span className="text-xl text-gray-500"> (Filtrelenmiş)</span>}
								</h2>
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{filteredSubmissions.map((submission: JotFormSubmission, index: number) => {
										const formData = submission.formDataJson as FormDataType;
										const profilePicUrl = getProfilePictureUrl(formData, 'q108_profilePicture108');
										const firmaAdi = getFormDataValue(formData, 'q5_nameOf');
										const email = getFormDataValue(formData, 'q16_email16');
										const phoneNumber = getFormDataValue(formData, 'q105_telephone105');
										const instagramHandle = getFormDataValue(formData, 'q31_instagramAdresi');
										const tiktokHandle = getFormDataValue(formData, 'q69_tiktok');
										const twitterHandle = getFormDataValue(formData, 'q70_twitter70');
										const linkedinHandle = getFormDataValue(formData, 'q32_linkedinAdresi');
										const facebookHandle = getFormDataValue(formData, 'q33_facebookAdresi');
										const websiteFieldContent = getFormDataValue(formData, 'q48_website');
										let goldenPagesLinkToShow: string | null = null;
										if (websiteFieldContent && websiteFieldContent !== 'N/A' && websiteFieldContent.trim() !== '') {
											const firmaAdiSlug = slugify(firmaAdi);
											if (firmaAdiSlug) {
												goldenPagesLinkToShow = `https://goldenpages.io/${firmaAdiSlug}`;
											}
										}
										const hasSocialMedia = [instagramHandle, tiktokHandle, twitterHandle, linkedinHandle, facebookHandle].some(handle => handle && handle !== 'N/A' && handle.trim() !== '');
										const googleMapHtml = getFormDataValue(formData, 'q103_googleMap');
										const isNewlyAdded = !anyFilterActive && index < 3;

										return (
											<div key={submission.id}
												 className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-[1.03] transition-all duration-300 ease-in-out group flex flex-col relative">
												{isNewlyAdded && (<div
													className="absolute top-0 right-0 bg-[#FCA300] text-white text-xs font-semibold py-1 px-3 rounded-bl-lg z-10">YENİ</div>)}
												<div className="p-6 flex-grow flex flex-col">
													<div className="flex items-start space-x-4 mb-4">
														{profilePicUrl ? (
															<img src={profilePicUrl} alt={`${firmaAdi} Profil Resmi`}
																 className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200 group-hover:border-[#FCA300] transition-colors"
																 onError={(e) => {
																	 (e.target as HTMLImageElement).style.display = 'none';
																 }}/>
														) : (
															<div
																className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-[#FCA300] group-hover:border-[#FCA300] border-2 border-gray-200 transition-colors placeholder-icon-container">
																<svg xmlns="http://www.w3.org/2000/svg" fill="none"
																	 viewBox="0 0 24 24" strokeWidth="1.5"
																	 stroke="currentColor" className="w-8 h-8">
																	<path strokeLinecap="round" strokeLinejoin="round"
																		  d="M2.25 21h19.5m-18-18v18A2.25 2.25 0 0 0 4.5 21h15a2.25 2.25 0 0 0 2.25-2.25V5.25A2.25 2.25 0 0 0 19.5 3H4.5A2.25 2.25 0 0 0 2.25 5.25v.897M7.5 4.5M7.5 12a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 0v3.375c0 .621.504 1.125 1.125 1.125h2.25c.621 0 1.125-.504 1.125-1.125V12Zm-1.125-4.5h4.5m-4.5 0h4.5m-4.5 0V3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V4.5m0 0v3.375c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 7.5 7.875V4.5m0 0h4.5M4.5 12h15M4.5 15h15M4.5 18h15"/>
																</svg>
															</div>
														)}
														<div className="flex-1 min-w-0">
															<span
																className="block text-xs font-medium text-[#FCA300] uppercase tracking-wider">Firma Adı</span>
															<p className="text-xl font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">{firmaAdi}</p>
														</div>
													</div>
													<ul className="space-y-3 mb-auto">
														<li><span
															className="block text-xs font-medium text-gray-500 uppercase tracking-wider">İş Sektörü</span>
															<p className="text-gray-700 truncate">{getFormDataValue(formData, 'q45_businessSector')}</p>
														</li>
														<li><span
															className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Şehir / Ülke</span>
															<p className="text-gray-700 truncate">{getFormDataValue(formData, 'q91_city', '') || 'Belirtilmemiş'} / {getFormDataValue(formData, 'q21_schreibenSie21')}</p>
														</li>
														{phoneNumber !== 'N/A' && (<li><span
															className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</span><a
															href={`tel:${phoneNumber.replace(/\s|\(|\)/g, '')}`}
															className="text-gray-700 hover:text-orange-500 transition-colors truncate block">{phoneNumber}</a>
														</li>)}
														{email !== 'N/A' && (<li><span
															className="block text-xs font-medium text-gray-500 uppercase tracking-wider">E-posta</span><a
															href={`mailto:${email}`}
															className="text-gray-700 hover:text-orange-500 transition-colors truncate block">{email}</a>
														</li>)}
														{goldenPagesLinkToShow && (<li><span
															className="block text-xs font-medium text-gray-500 uppercase tracking-wider">Website</span><a
															href={goldenPagesLinkToShow} target="_blank"
															rel="noopener noreferrer"
															className="text-gray-700 hover:text-orange-500 transition-colors truncate block">{goldenPagesLinkToShow}</a>
														</li>)}
													</ul>
													{hasSocialMedia && (
														<div className="pt-4 border-t border-gray-200 mt-4">
															<div className="flex items-center space-x-3 justify-center">


																{goldenPagesLinkToShow && (
																	<div>
																		<a
																			href={`https://${websiteFieldContent}`}
																			target="_blank"
																			rel="noopener noreferrer"
																			className="text-gray-700 hover:text-orange-500 transition-colors truncate block flex items-center gap-2"
																		>
																			<img src="globe.svg" width="24" height="24" alt="Website" className="flex-shrink-0" />
																		</a>
																	</div>
																)}


																{instagramHandle && instagramHandle !== 'N/A' && instagramHandle.trim() !== '' && (
																	<a href={formatSocialUrl('instagram', instagramHandle)}
																	   target="_blank" rel="noopener noreferrer"
																	   title="İnstagram"><img src="/instagram.png"
																							  alt="İnstagram"
																							  className="w-6 h-6 hover:opacity-75 transition-opacity"/></a>)}
																{tiktokHandle && tiktokHandle !== 'N/A' && tiktokHandle.trim() !== '' && (
																	<a href={formatSocialUrl('tiktok', tiktokHandle)}
																	   target="_blank" rel="noopener noreferrer"
																	   title="TikTok"><img src="/tiktok.png"
																						   alt="TikTok"
																						   className="w-6 h-6 hover:opacity-75 transition-opacity"/></a>)}
																{twitterHandle && twitterHandle !== 'N/A' && twitterHandle.trim() !== '' && (
																	<a href={formatSocialUrl('twitter', twitterHandle)}
																	   target="_blank" rel="noopener noreferrer"
																	   title="Twitter"><img src="/twitter.png"
																							alt="Twitter"
																							className="w-6 h-6 hover:opacity-75 transition-opacity"/></a>)}
																{linkedinHandle && linkedinHandle !== 'N/A' && linkedinHandle.trim() !== '' && (
																	<a href={formatSocialUrl('linkedin', linkedinHandle)}
																	   target="_blank" rel="noopener noreferrer"
																	   title="LinkedIn"><img src="/linkedin.png"
																							 alt="LinkedIn"
																							 className="w-6 h-6 hover:opacity-75 transition-opacity"/></a>)}
																{facebookHandle && facebookHandle !== 'N/A' && facebookHandle.trim() !== '' && (
																	<a href={formatSocialUrl('facebook', facebookHandle)}
																	   target="_blank" rel="noopener noreferrer"
																	   title="Facebook"><img src="/facebook.png"
																							 alt="Facebook"
																							 className="w-6 h-6 hover:opacity-75 transition-opacity"/></a>)}
															</div>
														</div>
													)}
													{googleMapHtml && googleMapHtml !== 'N/A' && googleMapHtml.trim().startsWith('<iframe') && (
														<div className="mt-4 pt-4 border-t border-gray-200">
															<div style={{
																maxHeight: '300px',
																overflowY: 'hidden',
																width: '100%'
															}}
																 className="rounded-md overflow-hidden border border-gray-200">
																<div dangerouslySetInnerHTML={{__html: googleMapHtml}}/>
															</div>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}