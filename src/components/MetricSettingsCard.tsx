import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export interface MetricSetting {
    id?: string;
    metric_id: string;
    weight: number;
    min_threshold: number;
    ideal_threshold: number;
    max_threshold: number;
    method: string | null;
    enabled: boolean;
}

interface MetricSettingsCardProps {
    metric: MetricSetting;
    label: { name: string; description: string; unit: string; color: string; category: 'audio' | 'video' };
    onToggle: (id: string, checked: boolean) => void;
    onWeightChange: (id: string, weight: number) => void;
    onThresholdChange: (id: string, field: 'min' | 'ideal' | 'max', value: number) => void;
    onMethodChange?: (id: string, method: string) => void;
    readOnly?: boolean;
}

export function MetricSettingsCard({
    metric,
    label,
    onToggle,
    onWeightChange,
    onThresholdChange,
    onMethodChange,
    readOnly = false
}: MetricSettingsCardProps) {
    return (
        <Card className={`transition-all ${!metric.enabled && 'opacity-60 grayscale'}`}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <Switch
                            id={`toggle-${metric.metric_id}`}
                            checked={metric.enabled}
                            onCheckedChange={(checked) => !readOnly && onToggle(metric.metric_id, checked)}
                            disabled={readOnly}
                        />
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                {label.name}
                            </CardTitle>
                            <CardDescription className="text-xs">{label.description}</CardDescription>
                        </div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${label.color}`} title="Category indicator" />
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Weight Control */}
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <Label>Impact Weight</Label>
                        <span className="font-mono font-medium">{metric.weight}%</span>
                    </div>
                    <Slider
                        value={[metric.weight]}
                        onValueChange={([v]) => !readOnly && onWeightChange(metric.metric_id, v)}
                        min={0}
                        max={100}
                        step={5}
                        disabled={!metric.enabled || readOnly}
                        className={readOnly ? 'cursor-not-allowed' : ''}
                    />
                </div>

                {/* Advanced Thresholds - Only show if enabled */}
                {metric.enabled && (
                    <div className="space-y-3 pt-2 border-t">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Thresholds & Configuration</Label>

                        <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Min ({label.unit})</Label>
                                <Input
                                    type="number"
                                    value={metric.min_threshold}
                                    onChange={(e) => !readOnly && onThresholdChange(metric.metric_id, 'min', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs px-2"
                                    disabled={readOnly}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Ideal ({label.unit})</Label>
                                <Input
                                    type="number"
                                    value={metric.ideal_threshold}
                                    onChange={(e) => !readOnly && onThresholdChange(metric.metric_id, 'ideal', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs px-2"
                                    disabled={readOnly}
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Max ({label.unit})</Label>
                                <Input
                                    type="number"
                                    value={metric.max_threshold}
                                    onChange={(e) => !readOnly && onThresholdChange(metric.metric_id, 'max', parseFloat(e.target.value) || 0)}
                                    className="h-7 text-xs px-2"
                                    disabled={readOnly}
                                />
                            </div>
                        </div>

                        {/* Method Selector (specific to speechRate currently) */}
                        {metric.metric_id === 'speechRate' && onMethodChange && (
                            <div className="space-y-1 pt-1">
                                <Label className="text-[10px] text-muted-foreground">Detection Method</Label>
                                <Select
                                    value={metric.method || 'spectral-flux'}
                                    onValueChange={(val) => !readOnly && onMethodChange(metric.metric_id, val)}
                                    disabled={readOnly}
                                >
                                    <SelectTrigger className="h-7 text-xs">
                                        <SelectValue placeholder="Select method" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="spectral-flux">Spectral Flux (Standard)</SelectItem>
                                        <SelectItem value="web-speech-api">Web Speech API (Browser)</SelectItem>
                                        <SelectItem value="deepgram-stt">Deepgram STT (High Accuracy)</SelectItem>
                                    </SelectContent>
                                </Select>
                                {metric.method === 'deepgram-stt' && (
                                    <p className="text-[10px] text-muted-foreground pt-0.5">
                                        Requires internet connection. Highly accurate.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
