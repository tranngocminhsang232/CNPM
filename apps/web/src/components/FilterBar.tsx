'use client';

interface FilterBarProps {
  city: string;
  carType: string;
  keylessOnly: boolean;
  onCityChange: (city: string) => void;
  onCarTypeChange: (carType: string) => void;
  onKeylessChange: (value: boolean) => void;
  onReset: () => void;
}

export function FilterBar({
  city,
  carType,
  keylessOnly,
  onCityChange,
  onCarTypeChange,
  onKeylessChange,
  onReset,
}: FilterBarProps) {
  const filtered = city !== 'ALL' || carType !== 'ALL' || keylessOnly;
  return (
    <section className="search-panel" aria-label="Tìm xe phù hợp">
      <div className="search-field">
        <label htmlFor="city-select">Bạn muốn nhận xe ở đâu?</label>
        <select
          id="city-select"
          data-testid="city-select"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
        >
          <option value="ALL">Tất cả địa điểm</option>
          <option>TP. Hồ Chí Minh</option>
          <option>Hà Nội</option>
          <option>Đà Nẵng</option>
        </select>
      </div>
      <div className="search-field">
        <label htmlFor="cartype-select">Dòng xe</label>
        <select
          id="cartype-select"
          data-testid="cartype-select"
          value={carType}
          onChange={(e) => onCarTypeChange(e.target.value)}
        >
          <option value="ALL">Tất cả dòng xe</option>
          <option value="SUV">SUV gầm cao</option>
          <option value="SEDAN">Sedan</option>
          <option value="MPV">MPV 7 chỗ</option>
          <option value="CROSSOVER">Crossover</option>
        </select>
      </div>
      <label className="keyless-filter" htmlFor="keyless-checkbox">
        <input
          id="keyless-checkbox"
          data-testid="keyless-checkbox"
          type="checkbox"
          checked={keylessOnly}
          onChange={(e) => onKeylessChange(e.target.checked)}
        />
        <span>
          Nhận xe Keyless<small>Mở khóa qua ứng dụng</small>
        </span>
      </label>
      {filtered && (
        <button
          type="button"
          className="filter-reset min-h-11"
          data-testid="reset-filter-btn"
          onClick={onReset}
        >
          Xóa bộ lọc
        </button>
      )}
    </section>
  );
}
