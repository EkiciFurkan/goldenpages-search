'use client';

import {useState, useEffect, useMemo} from 'react';
import {JotFormSubmission} from '@/generated/prisma/client';
import Select from 'react-select';
import {getData as getCountryData} from 'country-list';

type FormDataType = Record<string, unknown>;

function slugify(text: string): string {
	if (!text || text === 'N/A') {
		return '';
	}
	const turkishMap: Record<string, string> = {
		'ç': 'c', 'Ç': 'C',
		'ğ': 'g', 'Ğ': 'G',
		'ı': 'i', 'İ': 'I',
		'ö': 'o', 'Ö': 'O',
		'ş': 's', 'Ş': 'S',
		'ü': 'u', 'Ü': 'U'
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
	if (!value || value.trim() === '') {
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
			if (!cleanedValue.includes('/')) {
				return `https://www.linkedin.com/in/${cleanedValue}`;
			} else {
				return `https://www.linkedin.com/${cleanedValue}`;
			}
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

	const countryOptions = useMemo(() => {
		const countries = getCountryData();
		const options = countries.map(country => ({
			value: country.code,
			label: country.name,
		}));
		return [{value: '', label: 'Tüm Ülkeler'}, ...options];
	}, []);

	useEffect(() => {
		async function fetchSubmissions(): Promise<void> {
			try {
				const response = await fetch('/api/submissions');
				if (!response.ok) {
					throw new Error('Veri çekme işlemi başarısız oldu.');
				}
				const data: JotFormSubmission[] = await response.json();
				const sortedData = data.sort((a, b) => {
					const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
					const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

					if (isNaN(dateA) && isNaN(dateB)) {
						return 0;
					}
					if (isNaN(dateA)) {
						return 1;
					}
					if (isNaN(dateB)) {
						return -1;
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

	const filteredSubmissions = submissions.filter((submission: JotFormSubmission): boolean => {
		const firmaAdi = getFormDataValue(submission.formDataJson as FormDataType, 'q5_nameOf', '').toLowerCase();
		const submissionCountryName = getFormDataValue(submission.formDataJson as FormDataType, 'q21_schreibenSie21', '').trim().toLowerCase();
		const businessSector = getFormDataValue(submission.formDataJson as FormDataType, 'q45_businessSector', '').toLowerCase();
		const city = getFormDataValue(submission.formDataJson as FormDataType, 'q91_city', '').toLowerCase();

		const nameFilterPassed = filterText.trim()
			? firmaAdi.includes(filterText.trim().toLowerCase())
			: true;

		const countryFilterPassed = selectedCountry && selectedCountry.value
			? submissionCountryName === selectedCountry.label.toLowerCase() && submissionCountryName !== 'n/a'
			: true;

		const sectorFilterPassed = filterSector.trim()
			? businessSector.includes(filterSector.trim().toLowerCase())
			: true;

		const cityFilterPassed = filterCity.trim()
			? city.includes(filterCity.trim().toLowerCase())
			: true;

		return nameFilterPassed && countryFilterPassed && sectorFilterPassed && cityFilterPassed;
	});

	if (loading) {
		return (
			<main
				className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center"
			>
				<h1 className="text-2xl font-semibold text-gray-600">Şirketler Yükleniyor</h1>
			</main>
		);
	}

	if (error) {
		return (
			<main
				className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-700 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center text-center"
			>
				<h1 className="text-3xl font-bold text-red-600 mb-2">Bir Sorun Oluştu</h1>
				<p className="text-gray-700 text-lg">{error}</p>
			</main>
		);
	}

	const anyFilterActive = filterText.trim() || selectedCountry?.value || filterSector.trim() || filterCity.trim();

	return (
		<main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 p-4 sm:p-6 md:p-8">
			<div className="container mx-auto max-w-5xl">
				<div className="mb-8 text-center">
					<h1 className="text-4xl font-bold text-gray-900 mb-2">Firma Kayıtları</h1>
					<p className="text-lg text-[#FCA300]">En son gönderilere ve filtrelere göz atın.</p>
				</div>

				<div className="mb-8 flex flex-col sm:flex-row flex-wrap gap-4 items-stretch justify-center">
					<Select
						instanceId="country-filter-select"
						options={countryOptions}
						value={selectedCountry}
						onChange={(option) => setSelectedCountry(option as { value: string; label: string } | null)}
						isClearable={true}
						isSearchable={true}
						placeholder="Ülkeye göre ara..."
						className="w-full sm:w-auto sm:min-w-[200px] flex-grow text-gray-700"
						styles={{
							control: (baseStyles, state) => ({
								...baseStyles,
								backgroundColor: '#ffffff',
								borderColor: state.isFocused ? '#FCA300' : '#d1d5db',
								color: '#1f2937',
								borderRadius: '0.5rem',
								paddingTop: '0.30rem',
								paddingBottom: '0.30rem',
								boxShadow: state.isFocused ? `0 0 0 2px #FCA300` : '0 1px 3px 0 rgba(0,0,0,.05), 0 1px 2px -1px rgba(0,0,0,.05)',
								'&:hover': {
									borderColor: '#9ca3af',
								},
								minHeight: '50px',
								height: '50px',
							}),
							singleValue: (baseStyles) => ({...baseStyles, color: '#1f2937'}),
							placeholder: (baseStyles) => ({...baseStyles, color: '#6b7280'}),
							input: (baseStyles) => ({...baseStyles, color: '#1f2937'}),
							menu: (baseStyles) => ({...baseStyles, backgroundColor: '#ffffff', zIndex: 20}),
							option: (baseStyles, state) => ({
								...baseStyles,
								backgroundColor: state.isFocused ? '#f3f4f6' : state.isSelected ? '#fed7aa' : '#ffffff',
								color: state.isSelected ? '#9a3412' : '#1f2937',
								'&:active': {backgroundColor: '#fdba74'},
							}),
						}}
					/>

					<input
						type="text"
						placeholder="Şehre göre ara..."
						value={filterCity}
						onChange={(e): void => setFilterCity(e.target.value)}
						className="w-full sm:w-auto sm:min-w-[200px] flex-grow bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-lg py-3 px-4 shadow-sm focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out text-base h-[50px]"
					/>

					<input
						type="text"
						placeholder="İş sektörüne göre ara..."
						value={filterSector}
						onChange={(e): void => setFilterSector(e.target.value)}
						className="w-full sm:w-auto sm:min-w-[200px] flex-grow bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-lg py-3 px-4 shadow-sm focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out text-base h-[50px]"
					/>

					<input
						type="text"
						placeholder="Firma adına göre ara..."
						value={filterText}
						onChange={(e): void => setFilterText(e.target.value)}
						className="w-full sm:w-auto sm:min-w-[200px] flex-grow bg-white text-gray-800 placeholder-gray-500 border border-gray-300 rounded-lg py-3 px-4 shadow-sm focus:ring-2 focus:ring-[#FCA300] focus:border-[#FCA300] outline-none transition duration-150 ease-in-out text-base h-[50px]"
					/>
				</div>

				{submissions.length === 0 && !anyFilterActive ? (
					<div className="text-center py-12">
						<p className="text-xl text-gray-500">Henüz kaydedilmiş bir gönderi bulunmamaktadır.</p>
					</div>
				) : filteredSubmissions.length === 0 && anyFilterActive ? (
					<div className="text-center py-12">
						<p className="text-xl text-gray-500">
							Burada İlk Tıklayın İlk Siz <a href="https://www.gelbesayfa.com/firma-ekle/"
														   className="font-bold" target="_blank"
														   rel="noopener noreferrer">Kayıt Olun !</a>
						</p>
					</div>
				) : (
					<>
						<h2 className="text-3xl font-semibold text-gray-900 mb-6 text-left">
							En Son Kayıtlar
							{anyFilterActive && <span
								className="text-xl text-gray-500"> (Filtrelenmiş)</span>}
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{filteredSubmissions.map((submission: JotFormSubmission, index: number) => {
								const formData = submission.formDataJson as FormDataType;
								const profilePicUrl = getProfilePictureUrl(formData, 'q108_profilePicture108');
								const firmaAdi = getFormDataValue(formData, 'q5_nameOf');
								const email = getFormDataValue(formData, 'q16_email16');
								const phoneNumber = getFormDataValue(formData, 'q105_telephone105');

								const instagramHandle = getFormDataValue(formData, 'q31_instagramAdresi', '');
								const tiktokHandle = getFormDataValue(formData, 'q69_tiktok', '');
								const twitterHandle = getFormDataValue(formData, 'q70_twitter70', '');
								const linkedinHandle = getFormDataValue(formData, 'q32_linkedinAdresi', '');
								const facebookHandle = getFormDataValue(formData, 'q33_facebookAdresi', '');

								const websiteFieldContent = getFormDataValue(formData, 'q48_website', '');

								let goldenPagesLinkToShow: string | null = null;
								if (websiteFieldContent && websiteFieldContent !== 'N/A' && websiteFieldContent.trim() !== '') {
									const firmaAdiSlug = slugify(firmaAdi);
									if (firmaAdiSlug) {
										goldenPagesLinkToShow = `https://goldenpages.io/${firmaAdiSlug}`;
									}
								}

								const hasSocialMedia = (instagramHandle && instagramHandle !== 'N/A' && instagramHandle.trim() !== '') ||
									(tiktokHandle && tiktokHandle !== 'N/A' && tiktokHandle.trim() !== '') ||
									(twitterHandle && twitterHandle !== 'N/A' && twitterHandle.trim() !== '') ||
									(linkedinHandle && linkedinHandle !== 'N/A' && linkedinHandle.trim() !== '') ||
									(facebookHandle && facebookHandle !== 'N/A' && facebookHandle.trim() !== '');

								const googleMapHtml = getFormDataValue(formData, 'q103_googleMap', '');

								const isNewlyAdded = !anyFilterActive && index < 3;

								return (
									<div
										key={submission.id}
										className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-[1.03] transition-all duration-300 ease-in-out group flex flex-col relative"
									>
										{isNewlyAdded && (
											<div
												className="absolute top-0 right-0 bg-[#FCA300] text-white text-xs font-semibold py-1 px-3 rounded-bl-lg z-10"
											>
												YENİ
											</div>
										)}
										<div className="p-6 flex-grow flex flex-col">
											<div className="flex items-start space-x-4 mb-4">
												{profilePicUrl ? (
													<img
														src={profilePicUrl}
														alt={`${firmaAdi} Profil Resmi`}
														className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200 group-hover:border-[#FCA300] transition-colors"
														onError={(e) => {
															(e.target as HTMLImageElement).style.display = 'none';
														}}
													/>
												) : (
													<div
														className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-[#FCA300] group-hover:border-[#FCA300] border-2 border-gray-200 transition-colors"
													>
														<svg xmlns="http://www.w3.org/2000/svg" fill="none"
															 viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"
															 className="w-8 h-8"
														>
															<path strokeLinecap="round" strokeLinejoin="round"
																  d="M2.25 21h19.5m-18-18v18A2.25 2.25 0 0 0 4.5 21h15a2.25 2.25 0 0 0 2.25-2.25V5.25A2.25 2.25 0 0 0 19.5 3H4.5A2.25 2.25 0 0 0 2.25 5.25v.897M7.5 4.5M7.5 12a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Zm0 0v3.375c0 .621.504 1.125 1.125 1.125h2.25c.621 0 1.125-.504 1.125-1.125V12Zm-1.125-4.5h4.5m-4.5 0h4.5m-4.5 0V3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V4.5m0 0v3.375c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 0 1 7.5 7.875V4.5m0 0h4.5M4.5 12h15M4.5 15h15M4.5 18h15"
															/>
														</svg>
													</div>
												)}
												<div className="flex-1 min-w-0">
                                        <span
											className="block text-xs font-medium text-[#FCA300] uppercase tracking-wider"
										>
                                           Firma Adı
                                        </span>
													<p className="text-xl font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">
														{firmaAdi}
													</p>
												</div>
											</div>

											<ul className="space-y-3 mb-auto">
												<li>
                                        <span
											className="block text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
                                           İş Sektörü
                                        </span>
													<p className="text-gray-700 truncate">
														{getFormDataValue(formData, 'q45_businessSector')}
													</p>
												</li>
												<li>
                                        <span
											className="block text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
                                           Şehir / Ülke
                                        </span>
													<p className="text-gray-700 truncate">
														{getFormDataValue(formData, 'q91_city', '') || 'Belirtilmemiş'} / {getFormDataValue(formData, 'q21_schreibenSie21')}
													</p>
												</li>
												{phoneNumber !== 'N/A' && (
													<li>
                                           <span
											   className="block text-xs font-medium text-gray-500 uppercase tracking-wider"
										   >
                                              Telefon
                                           </span>
														<a
															href={`tel:${phoneNumber.replace(/\s|\(|\)/g, '')}`}
															className="text-gray-700 hover:text-orange-500 transition-colors truncate block"
														>
															{phoneNumber}
														</a>
													</li>
												)}
												<li>
                                        <span
											className="block text-xs font-medium text-gray-500 uppercase tracking-wider"
										>
                                           E-posta
                                        </span>
													<a
														href={`mailto:${email}`}
														className="text-gray-700 hover:text-orange-500 transition-colors truncate block"
													>
														{email}
													</a>
												</li>
												{goldenPagesLinkToShow && (
													<li>
                                           <span
											   className="block text-xs font-medium text-gray-500 uppercase tracking-wider"
										   >
                                              Website
                                           </span>
														<a
															href={goldenPagesLinkToShow}
															target="_blank" rel="noopener noreferrer"
															className="text-gray-700 hover:text-orange-500 transition-colors truncate block"
														>
															{goldenPagesLinkToShow}
														</a>
													</li>
												)}
											</ul>

											{hasSocialMedia && (
												<div className="pt-4 border-t border-gray-200 mt-4">
													<div className="flex items-center space-x-3 justify-center">
														{instagramHandle && instagramHandle !== 'N/A' && instagramHandle.trim() !== '' && (
															<a
																href={formatSocialUrl('instagram', instagramHandle)}
																target="_blank" rel="noopener noreferrer"
																title="İnstagram Profili"
															>
																<img src="/instagram.png" alt="İnstagram İkonu"
																	 className="w-6 h-6 hover:opacity-75 transition-opacity"/>
															</a>
														)}
														{tiktokHandle && tiktokHandle !== 'N/A' && tiktokHandle.trim() !== '' && (
															<a
																href={formatSocialUrl('tiktok', tiktokHandle)}
																target="_blank" rel="noopener noreferrer"
																title="TikTok Profili"
															>
																<img src="/tiktok.png" alt="TikTok İkonu"
																	 className="w-6 h-6 hover:opacity-75 transition-opacity"/>
															</a>
														)}
														{twitterHandle && twitterHandle !== 'N/A' && twitterHandle.trim() !== '' && (
															<a
																href={formatSocialUrl('twitter', twitterHandle)}
																target="_blank" rel="noopener noreferrer"
																title="Twitter Profili"
															>
																<img src="/twitter.png" alt="Twitter İkonu"
																	 className="w-6 h-6 hover:opacity-75 transition-opacity"/>
															</a>
														)}
														{linkedinHandle && linkedinHandle !== 'N/A' && linkedinHandle.trim() !== '' && (
															<a
																href={formatSocialUrl('linkedin', linkedinHandle)}
																target="_blank" rel="noopener noreferrer"
																title="LinkedIn Profili"
															>
																<img src="/linkedin.png" alt="LinkedIn İkonu"
																	 className="w-6 h-6 hover:opacity-75 transition-opacity"/>
															</a>
														)}
														{facebookHandle && facebookHandle !== 'N/A' && facebookHandle.trim() !== '' && (
															<a
																href={formatSocialUrl('facebook', facebookHandle)}
																target="_blank" rel="noopener noreferrer"
																title="Facebook Profili"
															>
																<img src="/facebook.png" alt="Facebook İkonu"
																	 className="w-6 h-6 hover:opacity-75 transition-opacity"/>
															</a>
														)}
													</div>
												</div>
											)}

											{googleMapHtml && googleMapHtml !== 'N/A' && googleMapHtml.trim().startsWith('<iframe') && (
												<div className="mt-4 pt-4 border-t border-gray-200">
													<div
														style={{maxHeight: '300px', overflowY: 'hidden', width: '100%'}}
														className="rounded-md overflow-hidden border border-gray-200"
													>
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
	);
}