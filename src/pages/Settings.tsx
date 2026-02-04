import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sliders, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { CalibrationWizard } from '@/components/CalibrationWizard';
import { CalibrationTest } from '@/components/CalibrationTest';

interface CalibratedDevice {
  deviceId: string;
  deviceLabel: string;
  noiseFloor: number;
  referenceLevel: number;
  calibrationGain: number;
  calibratedAt: string;
}

const Settings = () => {
  const [calibratedDevices, setCalibratedDevices] = useState<CalibratedDevice[]>([]);

  useEffect(() => {
    loadCalibratedDevices();
  }, []);

  const loadCalibratedDevices = () => {
    try {
      const stored = localStorage.getItem('calibratedDevices');
      if (stored) {
        const devices = JSON.parse(stored);
        setCalibratedDevices(Object.values(devices));
      }
    } catch (err) {
      console.error('Failed to load calibrated devices:', err);
    }
  };

  const handleRemoveDevice = (deviceId: string) => {
    try {
      const stored = localStorage.getItem('calibratedDevices');
      if (stored) {
        const devices = JSON.parse(stored);
        delete devices[deviceId];
        localStorage.setItem('calibratedDevices', JSON.stringify(devices));
        loadCalibratedDevices();
        toast.success('Device calibration removed');
      }
    } catch (err) {
      console.error('Failed to remove device:', err);
      toast.error('Failed to remove device');
    }
  };

  const handleClearAllCalibrations = () => {
    localStorage.removeItem('calibratedDevices');
    setCalibratedDevices([]);
    toast.success('All calibrations cleared');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Settings</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Device Calibration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CalibrationWizard />
        </motion.div>

        {/* Calibration Test */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <CalibrationTest />
        </motion.div>

        {/* Calibrated Devices List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-primary" />
                    Calibrated Devices
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    Devices with saved calibration data for consistent scoring
                  </CardDescription>
                </div>
                {calibratedDevices.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAllCalibrations}
                    className="text-destructive hover:text-destructive"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {calibratedDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No devices calibrated yet. Use the calibration wizard above to calibrate your microphone.
                </p>
              ) : (
                <div className="space-y-3">
                  {calibratedDevices.map((device) => (
                    <div
                      key={device.deviceId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {device.deviceLabel || 'Unknown Device'}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span>Noise: {device.noiseFloor.toFixed(1)} dB</span>
                          <span>Ref: {device.referenceLevel.toFixed(1)} dB</span>
                          <span>Gain: {device.calibrationGain.toFixed(2)}x</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Calibrated: {new Date(device.calibratedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveDevice(device.deviceId)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Metric weights and scoring thresholds are managed by your instructor in the Admin panel. 
                This ensures consistent evaluation across all learners.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default Settings;
