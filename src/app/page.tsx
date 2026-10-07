import { redirect } from 'next/navigation';

// Root redirect: send visitors to the default tenant's login page.
// Set NEXT_PUBLIC_DEFAULT_TENANT in .env to change this (e.g. forgetech-engineering).
export default function RootPage() {
  const slug = process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'login';
  redirect(slug !== 'login' ? `/${slug}` : '/login');
}
