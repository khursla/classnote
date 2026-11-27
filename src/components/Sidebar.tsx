'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import {
  BookOpen,
  Users,
  FileText,
  LayoutDashboard,
  ShieldCheck,
  Award,
  LogOut,
  PlayCircle,
  ExternalLink,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();

  if (pathname.startsWith('/report') || pathname.startsWith('/login')) return null;

  const role = profile?.role || 'student';

  const menuItems =
    role === 'student'
      ? [{ href: '/my-report', label: '내 누적 성적표', icon: Award }]
      : [
          { href: '/', label: '클래스 관리', icon: BookOpen },
          { href: '/students', label: '학생 관리', icon: Users },
          { href: '/exams', label: '문제지 · 자동채점', icon: FileText },
          { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
          ...(role === 'admin'
            ? [{ href: '/admin', label: '관리자 · 계정관리', icon: ShieldCheck }]
            : []),
        ];

  const roleLabel =
    role === 'admin' ? '최고 관리자' : role === 'teacher' ? '강사' : '학생 · 학부모';

  return (
    <aside className="w-60 bg-[#0b0d14] border-r border-gray-800/80 flex flex-col justify-between p-5 shrink-0">
      <div>
        <div className="text-xl font-extrabold text-white tracking-tight mb-8 px-2">
          ClassNote
        </div>
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                }`}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
          {role !== 'student' && (
            <a
              href="https://fineman.netlify.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800/50 transition"
            >
              <span className="flex items-center gap-3">
                <PlayCircle size={17} />
                에듀트랙 (강의 진도)
              </span>
              <ExternalLink size={13} className="opacity-60" />
            </a>
          )}
        </nav>
      </div>

      {/* 하단 로그인 정보 & 로그아웃 */}
      {profile && (
        <div className="pt-4 border-t border-gray-800/80 space-y-3">
          <div className="px-2">
            <div className="text-sm font-semibold text-white truncate">
              {profile.name || '사용자'}
            </div>
            <div className="text-[11px] text-blue-400 mt-0.5">{roleLabel}</div>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
          >
            <LogOut size={15} /> 로그아웃
          </button>
        </div>
      )}
    </aside>
  );
}