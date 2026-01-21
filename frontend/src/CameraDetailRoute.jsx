import { useParams, useSearchParams } from 'react-router-dom';
import CameraDetailPage from './CameraDetailPage';

function CameraDetailRoute() {
  const { cameraId } = useParams();
  const [searchParams] = useSearchParams();
  const cameraName = searchParams.get('name') || `Camera ${cameraId}`;

  const handleBack = () => {
    window.close(); // Close the tab
    // If window.close() doesn't work (some browsers block it), redirect back
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  return (
    <CameraDetailPage
      cameraId={cameraId}
      cameraName={cameraName}
      onBack={handleBack}
    />
  );
}

export default CameraDetailRoute;