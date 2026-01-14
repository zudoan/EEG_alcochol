export default function QuyTrinh() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Quy trình xử lý (Pipeline)</h2>
        <p className="mt-2 text-sm text-white/60">
          Trang này mô tả ngắn gọn các bước tiền xử lý và trích xuất đặc trưng đã triển khai trong project.
        </p>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="text-sm font-semibold">Luồng tổng quan</div>
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          {[
            { k: '1', t: 'Dữ liệu đầu vào', d: 'CSV EEG theo trial (kênh × thời gian) + nhãn a/c.' },
            { k: '2', t: 'Tiền xử lý', d: 'Chuẩn hoá cột, xử lý thiếu, tạo ma trận epoch.' },
            { k: '3', t: 'Đặc trưng', d: 'Welch PSD → bandpower theo dải + (tuỳ chọn) spectrogram.' },
            { k: '4', t: 'Huấn luyện', d: 'ML cổ điển trên bandpower; DL trên spectrogram (nếu có TF).' },
            { k: '5', t: 'Đánh giá/Lưu', d: 'Metrics, confusion matrix, lưu model + scaler.' },
          ].map((x) => (
            <div key={x.k} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-white/60">Bước {x.k}</div>
              <div className="mt-1 text-sm font-semibold">{x.t}</div>
              <div className="mt-2 text-xs text-white/70 leading-relaxed">{x.d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="text-sm font-semibold">Đầu vào / đầu ra</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>- <b>Input</b>: file CSV EEG (nhiều kênh), mỗi file chứa 1 trial + nhãn.</div>
            <div>- <b>Output (ML)</b>: vector feature <b>bandpower</b> theo (dải × kênh).</div>
            <div>- <b>Output (DL)</b>: ảnh <b>spectrogram</b> (tần số × thời gian).</div>
            <div>- <b>Artifacts</b>: model `.joblib/.keras`, `scaler_bp.joblib`, `metrics.json`, `eda.json`.</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="text-sm font-semibold">Ví dụ feature (dễ diễn giải)</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>- <code>bp_beta_FP1</code>: năng lượng dải beta (13–30Hz) tại kênh FP1.</div>
            <div>- <code>bp_alpha_O2</code>: năng lượng dải alpha (8–13Hz) tại kênh O2.</div>
            <div>
              Ý nghĩa: mô hình không nhìn “tín hiệu thô” trực tiếp, mà nhìn <b>năng lượng theo dải tần</b> ở từng vùng đầu.
            </div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold">Tổng quan</div>
        <div className="text-sm text-white/75 leading-relaxed">
          Pipeline được thiết kế theo luồng: <b>Đọc dữ liệu → Tiền xử lý → Trích xuất đặc trưng → Huấn luyện → Đánh giá → Lưu model</b>.
          Mục tiêu là tạo đặc trưng ổn định, dễ diễn giải, và hạn chế rò rỉ dữ liệu giữa train/test.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="text-sm font-semibold">1) Đọc & chuẩn hoá dữ liệu</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>- Chuẩn hoá tên cột (lowercase, dấu cách → _).</div>
            <div>- Tạo nhãn: <b>a → 1</b>, <b>c → 0</b>.</div>
            <div>- Gom về ma trận <b>(kênh × thời gian)</b> cho mỗi trial.</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="text-sm font-semibold">2) Xử lý thiếu dữ liệu (missing)</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>- Loại kênh có tỷ lệ thiếu &gt; 5%.</div>
            <div>- Nội suy theo thời gian (interpolate), sau đó bfill/ffill.</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="text-sm font-semibold">3) Trích xuất đặc trưng miền tần số</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>- Welch PSD: ước lượng mật độ phổ công suất theo tần số.</div>
            <div>- Bandpower: tích phân PSD trong từng dải tần (delta/theta/alpha/beta/gamma).</div>
            <div>- Spectrogram: PSD theo thời gian để quan sát biến thiên.</div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5 space-y-2">
          <div className="text-sm font-semibold">4) Chống rò rỉ dữ liệu</div>
          <div className="text-sm text-white/75 leading-relaxed space-y-2">
            <div>- Tính MD5 cho mỗi file train/test.</div>
            <div>- Loại file test trùng nội dung với train.</div>
            <div>- Giúp kết quả đánh giá “thực” hơn, tránh test bị lộ.</div>
          </div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold">5) Mô hình</div>
        <div className="text-sm text-white/75 leading-relaxed space-y-2">
          <div>- Nhóm ML cổ điển trên vector bandpower: Logistic Regression, Random Forest, KNN, MLP, (tuỳ môi trường) XGBoost.</div>
          <div>- Nhóm DL trên spectrogram: Small CNN, EfficientNet Transfer Learning (nếu cài TensorFlow).</div>
          <div>- Sau khi chạy, model được lưu trong thư mục <b>saved_models/</b>.</div>
        </div>
      </div>
    </div>
  )
}
