import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from '@/generated/prisma/client'; 

type RawRequestData = Record<string, unknown>;

const prisma = new PrismaClient(); 

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

		const submissionDataForPrisma = {
			formId: formIDValue,
			submissionId: submissionIDValue,
			formTitle: typeof formTitleValue === 'string' ? formTitleValue : undefined,
			submissionDate: new Date(),
			ipAddress: typeof ipValue === 'string' ? ipValue : undefined,
			formDataJson: parsedRawRequest as Prisma.InputJsonValue 
		};

		const savedSubmission = await prisma.jotFormSubmission.create({
			data: submissionDataForPrisma,
		});

		console.log("JotForm verisi başarıyla veritabanına kaydedildi:", savedSubmission);

		return NextResponse.json({
			success: true,
			message: "Form verisi başarıyla alındı ve kaydedildi",
			data: { databaseId: savedSubmission.id, submissionId: savedSubmission.submissionId }
		});

	} catch (error: unknown) {
		console.error("JotForm webhook veya veritabanı hatası:", error);
		let errorMessage: string = "Bilinmeyen bir sunucu hatası oluştu";
		let statusCode: number = 500;

		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			if (error.code === 'P2002') {
				errorMessage = "Bu gönderim ID'si zaten kaydedilmiş.";
				statusCode = 409;
				console.warn(`Tekrarlayan gönderim denemesi: ${ (error.meta?.target as string[] | undefined)?.join(', ') }`);
			} else {
				errorMessage = `Veritabanı hatası: ${error.message}`;
			}
		} else if (error instanceof Error) {
			errorMessage = error.message;
		}

		return NextResponse.json(
			{ success: false, message: errorMessage, errorDetails: String(error) },
			{ status: statusCode }
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