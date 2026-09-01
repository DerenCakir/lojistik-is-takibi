/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Portföy portalı tek dosyalık statik HTML. Tarayıcı bunu agresif
        // önbelleğe alırsa yeni sürüm kullanıcıya günlerce ulaşmaz.
        source: "/portfoy-portal.html",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
