/**
 * Portföy şemasına erişilemediğinde gösterilir.
 *
 * En sık sebebi: yerel geliştirmede DATABASE_URL SQLite'ı gösteriyor.
 * Portföy verisi yalnız Supabase bağlantısında bulunur (Railway).
 */
export default function PortfoyYok() {
  return (
    <>
      <div className="topbar">
        <div>
          <h2>Portföy İş Yükü</h2>
          <div className="sub">Veriye şu an ulaşılamıyor</div>
        </div>
      </div>
      <div className="content">
        <div className="card" style={{ padding: 24 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>
            Portföy şeması bu bağlantıda bulunamadı.
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
            Portföy verisi Supabase&apos;deki <code>portfoy</code> şemasında durur.
            Yerel geliştirmede <code>DATABASE_URL</code> SQLite&apos;ı gösterdiği için
            burada görünmez — canlı ortamda (Railway) çalışır.
            <br />
            Canlıda da bu mesajı görüyorsanız <code>portfoy</code> şemasının kurulu
            olduğunu ve bağlantı kullanıcısının okuma yetkisi olduğunu kontrol edin.
          </p>
        </div>
      </div>
    </>
  );
}
