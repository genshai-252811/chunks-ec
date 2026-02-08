import { AlertTriangle, AlertCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getRecalibrationStatus } from '@/lib/lufsNormalization';

interface RecalibrationAlertProps {
  deviceId?: string | null;
}

export const RecalibrationAlert = ({ deviceId }: RecalibrationAlertProps) => {
  if (!deviceId) return null;

  const status = getRecalibrationStatus(deviceId);

  if (status.status === 'good') return null;

  const isUrgent = status.status === 'recommend';

  return (
    <Alert variant={isUrgent ? 'destructive' : 'default'} className="mt-4">
      <div className="flex items-start gap-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 mt-0.5" />
        )}
        <div className="flex-1">
          <AlertTitle className="font-semibold mb-1">
            {isUrgent ? 'Recalibration Recommended' : 'Calibration Notice'}
          </AlertTitle>
          <AlertDescription className="text-sm mb-3">
            {status.message}
            {status.variance && (
              <div className="text-xs mt-1 opacity-80">
                Variance detected: {status.variance.toFixed(1)} units
              </div>
            )}
          </AlertDescription>
          <Link to="/settings">
            <Button variant={isUrgent ? 'default' : 'outline'} size="sm">
              <Settings className="w-3 h-3 mr-2" />
              Go to Calibration Settings
            </Button>
          </Link>
        </div>
      </div>
    </Alert>
  );
};
