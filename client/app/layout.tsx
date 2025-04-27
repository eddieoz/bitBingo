'use client'; // Required for QueryClientProvider

import "./globals.css"; // REMOVED backslash
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import 'bootstrap/dist/css/bootstrap.min.css'; // REMOVED backslash
// You might need other global imports or context providers here

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize QueryClient inside the component ensures it's
  // created once per render on the client.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      {/* <head> tag is automatically managed by Next.js unless you add a head.js file */}
      {/* Ensure no whitespace between html and body */}
      <body>{/* Removed whitespace before body */}
        <QueryClientProvider client={queryClient}>
          {children}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </body>
    </html>
  );
} 