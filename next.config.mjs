/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000', 
        '127.0.0.1:3000',
        'claus.angeljoan.com' // <-- Añade aquí tu subdominio real
      ] 
    }
  }
};

export default nextConfig;