import { NextRequest, NextResponse } from "next/server";

type RawRequestData = Record<string, unknown>;

type JotFormSubmission = {
	formID: string;
	submissionID: string;
	formTitle: string;
	submissionDate: string; 
	ip: string;
	formData: RawRequestData;
};

export async function POST(request: NextRequest) {
	try {
		const multiPartFormData: FormData = await request.formData();

		const formIDValue: FormDataEntryValue | null = multiPartFormData.get("formID");
		const submissionIDValue: FormDataEntryValue | null = multiPartFormData.get("submissionID");
		const formTitleValue: FormDataEntryValue | null = multiPartFormData.get("formTitle");
		const ipValue: FormDataEntryValue | null = multiPartFormData.get("ip");
		const rawRequestValue: FormDataEntryValue | null = multiPartFormData.get("rawRequest");

		if (!formIDValue || typeof formIDValue !== 'string' ||
			!submissionIDValue || typeof submissionIDValue !== 'string' ||
			!rawRequestValue || typeof rawRequestValue !== 'string') {
			return NextResponse.json(
				{ success: false, message: "Eksik veya geçersiz JotForm verisi (formID, submissionID, veya rawRequest eksik/hatalı tip)" },
				{ status: 400 }
			);
		}

		let parsedRawRequest: RawRequestData;
		try {
			parsedRawRequest = JSON.parse(rawRequestValue) as RawRequestData;
		} catch (parseError: unknown) {
			const errorMessage: string = parseError instanceof Error ? parseError.message : "Unknown JSON parsing error for rawRequest";
			console.error("rawRequest JSON parsing error:", parseError);
			return NextResponse.json(
				{
					success: false,
					message: "JotForm 'rawRequest' alanı JSON olarak ayrıştırılamadı.",
					errorDetails: errorMessage,
					rawRequestContent: rawRequestValue.substring(0, 500) + "..."
				},
				{ status: 400 }
			);
		}

		const submission: JotFormSubmission = {
			formID: formIDValue,
			submissionID: submissionIDValue,
			formTitle: typeof formTitleValue === 'string' ? formTitleValue : "Bilinmeyen Form",
			submissionDate: new Date().toISOString(),
			ip: typeof ipValue === 'string' ? ipValue : (request.headers.get("x-forwarded-for") || "unknown"),
			formData: parsedRawRequest
		};

		console.log("JotForm verisi (multipart) alındı ve işlendi:", submission);


		return NextResponse.json({
			success: true,
			message: "Form verisi başarıyla alındı",
			data: { id: submission.submissionID }
		});

	} catch (error: unknown) {
		console.error("JotForm webhook genel hatası:", error);
		const errorMessage: string = error instanceof Error ? error.message : "Bilinmeyen bir sunucu hatası oluştu";
		return NextResponse.json(
			{ success: false, message: "Sunucu hatası oluştu", error: errorMessage },
			{ status: 500 }
		);
	}
}

export async function GET() {
	return NextResponse.json(
		{ success: false, message: "Method Not Allowed" },
		{ status: 405 }
	);
}

export async function PUT() {
	return NextResponse.json(
		{ success: false, message: "Method Not Allowed" },
		{ status: 405 }
	);
}

export async function DELETE() {
	return NextResponse.json(
		{ success: false, message: "Method Not Allowed" },
		{ status: 405 }
	);
}