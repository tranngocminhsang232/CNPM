'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { fetchVehicles, type VehicleSummary, type PaginationMeta } from '../lib/api';
import { VehicleCard } from '../components/VehicleCard';
import { FilterBar } from '../components/FilterBar';

export default function HomePage() {
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    pageSize: 6,
    total: 0,
    totalPages: 1,
  });
  const [city, setCity] = useState('ALL');
  const [carType, setCarType] = useState('ALL');
  const [keylessOnly, setKeylessOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    setLoading(true);
    setError(false);
    fetchVehicles({
      city: city === 'ALL' ? undefined : city,
      carType: carType === 'ALL' ? undefined : carType,
      keylessOnly: keylessOnly || undefined,
      page,
      pageSize: 6,
    })
      .then((response) => {
        if (request.current === current) {
          setVehicles(response.data);
          setMeta(response.meta);
        }
      })
      .catch(() => {
        if (request.current === current) setError(true);
      })
      .finally(() => {
        if (request.current === current) setLoading(false);
      });
    return () => {
      request.current++;
    };
  }, [city, carType, keylessOnly, page, attempt]);
  const reset = () => {
    setCity('ALL');
    setCarType('ALL');
    setKeylessOnly(false);
    setPage(1);
  };
  return (
    <>
      <main id="main-content" tabIndex={-1} className="site-container home-main">
        <section className="rental-intro" aria-labelledby="rental-heading">
          <div className="rental-intro-copy">
            <p className="eyebrow">Thuê xe tự lái cùng CarShare</p>
            <h1 id="rental-heading">
              Chọn xe.
              <br />
              Mở lối hành trình.
            </h1>
            <p>
              Một chuyến đi gần, một kế hoạch xa.
              <br className="desktop-break" /> Tìm chiếc xe phù hợp và chủ động tay lái.
            </p>
            <a href="#available-vehicles" className="intro-link">
              Khám phá những chiếc xe <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="rental-intro-photo">
            <img
              src="/images/vehicles/10000000-0000-0000-0000-000000000001/cover.jpg"
              alt="Xe tự lái cho hành trình của bạn"
              width="640"
              height="420"
              fetchPriority="high"
            />
            <span className="photo-caption">Đi theo cách bạn muốn.</span>
          </div>
        </section>
        <FilterBar
          city={city}
          carType={carType}
          keylessOnly={keylessOnly}
          onCityChange={(value) => {
            setCity(value);
            setPage(1);
          }}
          onCarTypeChange={(value) => {
            setCarType(value);
            setPage(1);
          }}
          onKeylessChange={(value) => {
            setKeylessOnly(value);
            setPage(1);
          }}
          onReset={reset}
        />
        <section
          id="available-vehicles"
          className="vehicle-results"
          aria-labelledby="results-heading"
          aria-busy={loading}
        >
          <div className="results-heading">
            <div>
              <p className="eyebrow">Sẵn sàng cho chuyến đi tiếp theo</p>
              <h2 id="results-heading">Xe dành cho bạn</h2>
            </div>
            <p role="status" aria-live="polite" aria-atomic="true">
              {loading ? (
                'Đang tìm xe…'
              ) : error ? (
                'Tạm thời chưa tải được dữ liệu'
              ) : (
                <>
                  <span data-testid="total-count">{meta.total}</span> xe phù hợp
                </>
              )}
            </p>
          </div>
          {loading ? (
            <div className="vehicle-grid" data-testid="loading-state">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="vehicle-skeleton">
                  <div />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : error ? (
            <div data-testid="error-state" className="result-state" role="alert">
              <span className="state-symbol" aria-hidden="true">
                ↻
              </span>
              <h3>Chưa thể tải danh sách xe</h3>
              <p>Kết nối đang gián đoạn. Hãy thử lại để tiếp tục tìm xe.</p>
              <button
                type="button"
                data-testid="retry-btn"
                className="button button-primary"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Thử lại kết nối
              </button>
            </div>
          ) : vehicles.length === 0 ? (
            <div data-testid="empty-state" className="result-state">
              <span className="state-symbol" aria-hidden="true">
                ⌕
              </span>
              <h3>Chưa tìm thấy xe phù hợp</h3>
              <p>Thử đổi địa điểm hoặc dòng xe để có thêm lựa chọn.</p>
              <button type="button" className="button button-secondary" onClick={reset}>
                Đặt lại tất cả bộ lọc
              </button>
            </div>
          ) : (
            <>
              <div data-testid="vehicles-grid" className="vehicle-grid">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} />
                ))}
              </div>
              {meta.totalPages > 1 && (
                <nav className="pagination" aria-label="Phân trang danh sách xe">
                  <button
                    type="button"
                    className="button button-secondary"
                    data-testid="prev-page-btn"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    ← Trang trước
                  </button>
                  <span aria-live="polite">
                    {meta.page} / {meta.totalPages}
                  </span>
                  <button
                    type="button"
                    className="button button-secondary"
                    data-testid="next-page-btn"
                    disabled={page >= meta.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Trang sau →
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
        <section className="owner-invitation">
          <div>
            <h2>Xe nghỉ ngơi. Cơ hội vẫn chạy.</h2>
            <p>Đăng xe và quản lý các yêu cầu thuê trong cùng một nơi.</p>
          </div>
          <Link href="/owner/vehicles/new" className="button button-secondary">
            Trở thành chủ xe <span aria-hidden="true">↗</span>
          </Link>
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-container">
          <span className="footer-brand">CarShare.</span>
          <p>Cùng bạn chủ động trên mọi hành trình.</p>
          <Link href="/owner/dashboard">Dành cho chủ xe</Link>
        </div>
      </footer>
    </>
  );
}
