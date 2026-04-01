import { useRef } from "react";

interface FormData {
  pictureUrl?: string;
  [key: string]: any;
}

interface Styles {
  label?: React.CSSProperties;
  input?: React.CSSProperties;
}

interface UrlManagerProps {
  imageList: string[];
  setImageList: (imageList: string[]) => void;
  formData: FormData | null;
  setFormData: React.Dispatch<React.SetStateAction<FormData | null>>;
  show: boolean;
  setShow: (show: boolean) => void;
  styles: Styles;
}

export default function UrlManager({
  imageList,
  setImageList,
  formData,
  setFormData,
  show,
  setShow,
  styles
}: UrlManagerProps) {
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const handleChange = (value: string, index: number) => {
    const updated = [...imageList];

    if (index < updated.length) {
      updated[index] = value;
    } else if (value.trim() !== "") {
      updated.push(value);
    }

    const filtered = updated.filter(Boolean);

    setImageList(filtered);

    setFormData(prev =>
      prev ? { ...prev, pictureUrl: filtered.join(",") } : prev
    );
  };

  const handleRemove = (index: number) => {
    const updated = imageList.filter((_, i) => i !== index);

    setImageList(updated);

    setFormData(prev =>
      prev ? { ...prev, pictureUrl: updated.join(",") } : prev
    );
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px"
        }}
      >
        <label style={styles.label}>
          Imagens ({imageList.length})
        </label>

        <button
          ref={btnRef}
          onClick={() => setShow(!show)}
          style={{
            padding: "4px 12px",
            fontSize: "11px",
            backgroundColor: show ? "#ef4444" : "#2563eb",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          {show ? "Fechar" : "Gerenciar URLs"}
        </button>

        {show && (
          <div
            style={{
              position: "fixed",
              top: btnRef.current
                ? btnRef.current.getBoundingClientRect().bottom + 8
                : 0,
              left: btnRef.current
                ? btnRef.current.getBoundingClientRect().left - 240
                : 0,
              zIndex: 9999,
              backgroundColor: "white",
              padding: "16px",
              borderRadius: "12px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
              border: "1px solid #e5e7eb",
              width: "320px"
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "-6px",
                right: "25px",
                width: "12px",
                height: "12px",
                backgroundColor: "white",
                transform: "rotate(45deg)",
                borderLeft: "1px solid #e5e7eb",
                borderTop: "1px solid #e5e7eb"
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between"
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: "bold",
                    color: "#6b7280"
                  }}
                >
                  GERENCIAR LINKS DAS IMAGENS
                </span>

                <button
                  onClick={() => setShow(false)}
                  style={{
                    border: "none",
                    cursor: "pointer",
                    fontSize: "16px",
                    backgroundColor: "#f3f4f6",
                    color: "#6b7280",
                    borderRadius: "50%",
                    width: "24px",
                    height: "24px"
                  }}
                >
                  &times;
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  maxHeight: "220px",
                  overflowY: "auto"
                }}
              >
                {[...imageList, ""].map((url, index) => (
                  <div
                    key={index}
                    style={{ display: "flex", gap: "8px" }}
                  >
                    <input
                      type="text"
                      value={url}
                      placeholder="Cole o link da imagem..."
                      style={{
                        ...styles.input,
                        flex: 1,
                        fontSize: "12px",
                        height: "32px",
                        borderColor: url ? "#2563eb" : "#d1d5db"
                      }}
                      onChange={(e) =>
                        handleChange(e.target.value, index)
                      }
                    />

                    {url && (
                      <button
                        onClick={() => handleRemove(index)}
                        style={{
                          border: "none",
                          background: "#fee2e2",
                          color: "#ef4444",
                          borderRadius: "4px",
                          width: "24px",
                          height: "24px",
                          cursor: "pointer"
                        }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}