import {
  ImageOutlined,
  InsertDriveFileOutlined,
  PictureAsPdfOutlined,
} from "@mui/icons-material";

export default function FileIcon({ type }) {
  if (type === "image") return <ImageOutlined className="file-type image" />;
  if (type === "pdf") return <PictureAsPdfOutlined className="file-type pdf" />;
  return (
    <InsertDriveFileOutlined
      className={`file-type ${type === "doc" ? "doc" : ""}`}
    />
  );
}
