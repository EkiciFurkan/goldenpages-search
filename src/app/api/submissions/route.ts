import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';

const prisma = new PrismaClient();

export async function GET() {
	try {
		const submissions = await prisma.jotFormSubmission.findMany({
			where: {
				deletedAt: null,
			},
			orderBy: {
				createdAt: 'desc'
			},
		});
		return NextResponse.json(submissions);
	} catch (error) {
		console.error('Veri çekme hatası:', error);
		return NextResponse.json(
			{ error: 'Gönderiler yüklenirken bir hata oluştu.' },
			{ status: 500 }
		);
	}
}