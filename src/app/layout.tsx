import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import Sidebar from '@/components/Sidebar';

export const instant = false;

export const metadata: Metadata = {
  title: 'ClassNote - 학원 클래스 관리',
  description: '수강생, 시험지, 자동채점 및 성적표 관리 웹앱',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#0f1117] text-gray-100 antialiased">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
              불러오는 중...
            </div>
          }
        >
          <AuthProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 p-8 max-w-6xl">{children}</main>
            </div>
          </AuthProvider>
        </Suspense>
      </body>
    </html>
  );
}