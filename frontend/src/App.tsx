import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  UploadCloud,
  Image as ImageIcon,
  ShieldCheck,
  Trash2,
  RefreshCw,
  LoaderCircle,
  FileImage,
  AlertTriangle,
} from "lucide-react";
type Status = "PENDING" | "PROCESSING" | "ACCEPTED" | "REJECTED" | "FAILED";
type ImageRecord = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  status: Status;
  createdAt: string;
  validationResults: any;
  previewUrl: string;
};
const API = "/api";
const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif"];
function prettyBytes(n: number) {
  return n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function describeUploadError(
  fileName: string,
  status: number,
  detail?: string,
) {
  const normalized = (detail || "").trim();
  if (status === 415 || /unsupported|invalid image content/i.test(normalized)) {
    return `${fileName}: unsupported image type. Only JPG, PNG, and HEIC are allowed.`;
  }
  if (status === 413 || /exceeds the .* MB limit/i.test(normalized)) {
    return `${fileName}: exceeds the 15 MB upload limit.`;
  }
  if (normalized) return `${fileName}: ${normalized}`;
  return `${fileName}: upload failed.`;
}
function App() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [selected, setSelected] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "ACCEPTED" | "REJECTED" | "PROCESSING"
  >("ALL");
  const inputRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/images`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setImages(d.images);
    } catch {
      setNotice(
        "API is not reachable. Start the Docker Compose services and refresh.",
      );
    }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(load, 1800);
    return () => clearInterval(timer);
  }, [load]);
  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const invalid = list.filter(
      (f) =>
        !allowed.includes(f.type) && !/\.(jpe?g|png|heic|heif)$/i.test(f.name),
    );
    if (invalid.length) {
      setNotice(
        `Unsupported format: ${invalid.map((f) => f.name).join(", ")}. Use JPG, PNG, or HEIC.`,
      );
      return;
    }
    const valid = list.filter(
      (f) =>
        allowed.includes(f.type) || /\.(jpe?g|png|heic|heif)$/i.test(f.name),
    );
    setSelected((prev) => [...prev, ...valid].slice(0, 20));
  };
  const uploadAll = async () => {
    if (!selected.length) {
      setNotice(
        "No valid files selected. Please choose JPG, PNG, or HEIC images only.",
      );
      return;
    }
    setUploading(true);
    setNotice("");
    const failures: string[] = [];
    let uploadedCount = 0;
    for (const file of selected) {
      if (file.size > 15 * 1024 * 1024) {
        failures.push(`${file.name}: exceeds the 15 MB upload limit.`);
        continue;
      }
      const body = new FormData();
      body.append("image", file);
      try {
        const response = await fetch(`${API}/images`, { method: "POST", body });
        const data = await response.json();
        if (!response.ok) {
          failures.push(
            describeUploadError(file.name, response.status, data?.error),
          );
          continue;
        }
        uploadedCount += 1;
        await load();
      } catch {
        failures.push(
          `${file.name}: could not upload. Check that the API is running.`,
        );
      }
    }
    setSelected([]);
    setUploading(false);
    if (failures.length) {
      setNotice(failures.join(" • "));
    } else if (uploadedCount > 0) {
      setNotice("Uploads received. Validation runs in the background.");
    }
    await load();
  };
  const remove = async (id: string) => {
    try {
      await fetch(`${API}/images/${id}`, { method: "DELETE" });
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setNotice("Delete failed.");
    }
  };
  const visible = images.filter(
    (i) =>
      filter === "ALL" ||
      (filter === "PROCESSING"
        ? ["PENDING", "PROCESSING"].includes(i.status)
        : i.status === filter),
  );
  const accepted = images.filter((i) => i.status === "ACCEPTED").length;
  const rejected = images.filter((i) => i.status === "REJECTED").length;
  const processing = images.filter((i) =>
    ["PENDING", "PROCESSING"].includes(i.status),
  ).length;
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <ImageIcon size={20} />
          </div>
          <div>
            <strong>Image Review Studio</strong>
            <span>VALIDATION WORKSPACE</span>
          </div>
        </div>
      </header>
      <section className="hero">
        <div>
          <div className="eyebrow">
            <ShieldCheck size={14} /> IMAGE QUALITY GATE
          </div>
          <h1>
            Every image.
            <br />
            <em>Quality checked.</em>
          </h1>
          <p>
            Upload portraits and let the validation pipeline review format,
            resolution, sharpness, similarity, and face count.
          </p>
        </div>
        <div className="hero-art">
          <div className="art-ring ring-one" />
          <div className="art-ring ring-two" />
          <div className="art-card">
            <FileImage size={31} />
            <span>IMAGE</span>
            <b>✓</b>
          </div>
          <div className="art-chip">AI QUALITY CHECK</div>
        </div>
      </section>
      <section className="stats">
        <button
          className={`stat ${filter === "ALL" ? "active" : ""}`}
          onClick={() => setFilter("ALL")}
        >
          <span className="stat-icon neutral">
            <ImageIcon size={17} />
          </span>
          <span>
            <small>Total images</small>
            <strong>{images.length}</strong>
          </span>
        </button>
        <button
          className={`stat ${filter === "ACCEPTED" ? "active" : ""}`}
          onClick={() => setFilter("ACCEPTED")}
        >
          <span className="stat-icon green">
            <CheckCircle2 size={17} />
          </span>
          <span>
            <small>Accepted</small>
            <strong>{accepted}</strong>
          </span>
        </button>
        <button
          className={`stat ${filter === "REJECTED" ? "active" : ""}`}
          onClick={() => setFilter("REJECTED")}
        >
          <span className="stat-icon red">
            <XCircle size={17} />
          </span>
          <span>
            <small>Rejected</small>
            <strong>{rejected}</strong>
          </span>
        </button>
        <button
          className={`stat ${filter === "PROCESSING" ? "active" : ""}`}
          onClick={() => setFilter("PROCESSING")}
        >
          <span className="stat-icon amber">
            <Clock3 size={17} />
          </span>
          <span>
            <small>Processing</small>
            <strong>{processing}</strong>
          </span>
        </button>
      </section>
      <section className="upload-panel">
        <div className="section-head">
          <div>
            <h2>Upload images</h2>
            <p>Choose files or drag them into the upload area.</p>
          </div>
          <span className="format-pill">
            JPG · PNG · HEIC <span>·</span> Max 15 MB
          </span>
        </div>
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <div className="upload-icon">
            <UploadCloud size={26} />
          </div>
          <strong>Drop your images here</strong>
          <span>
            or{" "}
            <button
              className="text-button"
              onClick={() => inputRef.current?.click()}
            >
              browse files
            </button>{" "}
            from your computer
          </span>
          <small>JPEG, PNG, HEIC / HEIF · up to 15 MB per image</small>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.currentTarget.value = "";
            }}
          />
        </div>
        {selected.length > 0 && (
          <div className="queue">
            <div className="queue-head">
              <strong>
                {selected.length} file{selected.length > 1 ? "s" : ""} ready
              </strong>
              <button className="text-button" onClick={() => setSelected([])}>
                Clear all
              </button>
            </div>
            {selected.map((f, i) => (
              <div className="queue-item" key={`${f.name}-${i}`}>
                <FileImage size={18} />
                <span>
                  {f.name}
                  <small>{prettyBytes(f.size)}</small>
                </span>
                <button
                  aria-label="Remove file"
                  onClick={() =>
                    setSelected((s) => s.filter((_, j) => i !== j))
                  }
                >
                  <XCircle size={17} />
                </button>
              </div>
            ))}
            <button
              className="primary"
              disabled={uploading}
              onClick={uploadAll}
            >
              {uploading ? (
                <>
                  <LoaderCircle className="spin" size={17} /> Uploading…
                </>
              ) : (
                <>
                  <UploadCloud size={17} /> Upload {selected.length} image
                  {selected.length > 1 ? "s" : ""}
                </>
              )}
            </button>
          </div>
        )}
        {notice && (
          <div className="notice">
            <AlertTriangle size={16} />
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss">
              ×
            </button>
          </div>
        )}
      </section>
      <section className="results">
        <div className="section-head">
          <div>
            <h2>Validation results</h2>
            <p>Live status updates from the image-processing worker.</p>
          </div>
          <button className="refresh" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
        <div className="filter-row">
          {(["ALL", "ACCEPTED", "REJECTED", "PROCESSING"] as const).map((f) => (
            <button
              key={f}
              className={filter === f ? "selected" : ""}
              onClick={() => setFilter(f)}
            >
              {f === "ALL"
                ? "All images"
                : f === "PROCESSING"
                  ? "Processing"
                  : f[0] + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <div className="empty">
            <div>
              <ImageIcon size={27} />
            </div>
            <strong>No images here yet</strong>
            <span>Upload an image to see validation results.</span>
          </div>
        ) : (
          <div className="image-grid">
            {visible.map((img) => (
              <article className="image-card" key={img.id}>
                <div className="preview">
                  <img
                    src={`${API}/images/${img.id}/file`}
                    alt={img.originalFilename}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        "none";
                    }}
                  />
                  <StatusBadge status={img.status} />
                  <button
                    className="delete"
                    onClick={() => remove(img.id)}
                    aria-label="Delete image"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="card-body">
                  <div className="file-title" title={img.originalFilename}>
                    {img.originalFilename}
                  </div>
                  <div className="meta">
                    {img.width && img.height
                      ? `${img.width} × ${img.height} · `
                      : ""}
                    {prettyBytes(img.sizeBytes)}
                  </div>
                  {["PENDING", "PROCESSING"].includes(img.status) ? (
                    <div className="processing">
                      <LoaderCircle size={14} className="spin" /> Running
                      quality checks…
                    </div>
                  ) : img.status === "FAILED" ? (
                    <div className="reason fail">
                      Processing failed. Try uploading the image again.
                    </div>
                  ) : img.status === "REJECTED" ? (
                    <div className="reason">
                      {(
                        img.validationResults?.rejectionReasons || [
                          "Image did not pass validation.",
                        ]
                      ).map((r: string) => (
                        <span key={r}>
                          <XCircle size={13} />
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="reason success">
                      <CheckCircle2 size={14} /> All validations passed
                    </div>
                  )}
                  {img.validationResults?.checks && (
                    <details>
                      <summary>Validation details</summary>
                      <div className="check-list">
                        {Object.entries(img.validationResults.checks).map(
                          ([k, v]: [string, any]) => (
                            <span
                              key={k}
                              className={v.passed ? "pass" : "fail"}
                            >
                              {v.passed ? "✓" : "×"}{" "}
                              {k.replace(/([A-Z])/g, " $1").toLowerCase()}
                              {typeof v.score === "number"
                                ? ` (${v.score})`
                                : ""}
                            </span>
                          ),
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer>
        <span>IMAGE REVIEW STUDIO</span>
        <span>Async validation · PostgreSQL · Redis queue</span>
      </footer>
    </main>
  );
}
function StatusBadge({ status }: { status: Status }) {
  const map: any = {
    ACCEPTED: { icon: <CheckCircle2 size={13} />, label: "Accepted" },
    REJECTED: { icon: <XCircle size={13} />, label: "Rejected" },
    PENDING: { icon: <Clock3 size={13} />, label: "Pending" },
    PROCESSING: { icon: <LoaderCircle size={13} />, label: "Processing" },
    FAILED: { icon: <AlertTriangle size={13} />, label: "Failed" },
  };
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      {map[status].icon}
      {map[status].label}
    </span>
  );
}
export default App;
