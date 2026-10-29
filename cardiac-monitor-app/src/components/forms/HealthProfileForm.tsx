import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppStore } from '../../store/useAppStore';
import { healthProfileSchema } from '../../utils/validation';
import { ACTIVITY_LEVELS, GENDERS } from '../../constants';
import { Colors, Spacing, FontSize, BorderRadius, Shadow } from '../../theme';
import type { ActivityLevel, Gender, HealthProfile } from '../../types';

interface HealthProfileFormProps {
  onSubmit: (profile: HealthProfile) => void | Promise<void>;
  submitLabel: string;
  loading?: boolean;
  error?: string | null;
}

interface FormState {
  age: string;
  gender: Gender;
  heightCm: string;
  weightKg: string;
  activityLevel: ActivityLevel;
  sleepHours: string;
  stressLevel: string;
  smoking: boolean;
  diabetes: boolean;
  hypertension: boolean;
}

const initialForm = (): FormState => {
  const profile = useAppStore.getState().user?.healthProfile ?? null;
  return {
    age: profile ? String(profile.age) : '',
    gender: profile?.gender ?? 'Male',
    heightCm: profile ? String(profile.heightCm) : '',
    weightKg: profile ? String(profile.weightKg) : '',
    activityLevel: profile?.activityLevel ?? 'Moderately Active',
    sleepHours: profile ? String(profile.sleepHours) : '7',
    stressLevel: profile ? String(profile.stressLevel) : '30',
    smoking: profile?.smoking ?? false,
    diabetes: profile?.diabetes ?? false,
    hypertension: profile?.hypertension ?? false,
  };
};

const computeBmi = (heightCm: number, weightKg: number): number | null => {
  if (!heightCm || !weightKg) return null;
  const meters = heightCm / 100;
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
};

const HealthProfileForm: React.FC<HealthProfileFormProps> = ({
  onSubmit,
  submitLabel,
  loading,
  error,
}) => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const bmi = computeBmi(Number(form.heightCm), Number(form.weightKg));

  const handleSubmit = () => {
    const result = healthProfileSchema.safeParse({
      age: form.age,
      gender: form.gender,
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      activityLevel: form.activityLevel,
      sleepHours: form.sleepHours,
      stressLevel: form.stressLevel,
      smoking: form.smoking,
      diabetes: form.diabetes,
      hypertension: form.hypertension,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = String(issue.path[0]);
        if (!errors[key]) errors[key] = issue.message;
      });
      setFieldErrors(errors);
      return;
    }

    const computedBmi = computeBmi(result.data.heightCm, result.data.weightKg);
    onSubmit({ ...result.data, bmi: computedBmi ?? 0 });
  };

  return (
    <View>
      {error && (
        <View style={styles.errorBanner}>
          <MaterialCommunityIcons name="alert-circle" size={16} color={Colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Body</Text>

      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.half]}>
          <Text style={styles.label}>Age</Text>
          <TextInput
            style={[styles.input, fieldErrors.age && styles.inputError]}
            placeholder="e.g. 32"
            placeholderTextColor={Colors.textSecondary}
            value={form.age}
            onChangeText={(v) => handleChange('age', v)}
            keyboardType="number-pad"
          />
          {fieldErrors.age && <Text style={styles.fieldError}>{fieldErrors.age}</Text>}
        </View>

        <View style={[styles.inputGroup, styles.half]}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.segmented}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.segment, form.gender === g && styles.segmentActive]}
                onPress={() => handleChange('gender', g)}
              >
                <Text style={[styles.segmentText, form.gender === g && styles.segmentTextActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.half]}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput
            style={[styles.input, fieldErrors.heightCm && styles.inputError]}
            placeholder="e.g. 175"
            placeholderTextColor={Colors.textSecondary}
            value={form.heightCm}
            onChangeText={(v) => handleChange('heightCm', v)}
            keyboardType="numeric"
          />
          {fieldErrors.heightCm && <Text style={styles.fieldError}>{fieldErrors.heightCm}</Text>}
        </View>

        <View style={[styles.inputGroup, styles.half]}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={[styles.input, fieldErrors.weightKg && styles.inputError]}
            placeholder="e.g. 70"
            placeholderTextColor={Colors.textSecondary}
            value={form.weightKg}
            onChangeText={(v) => handleChange('weightKg', v)}
            keyboardType="numeric"
          />
          {fieldErrors.weightKg && <Text style={styles.fieldError}>{fieldErrors.weightKg}</Text>}
        </View>
      </View>

      {bmi !== null && (
        <View style={styles.bmiBadge}>
          <Text style={styles.bmiBadgeText}>Calculated BMI: {bmi}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Lifestyle</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Activity Level</Text>
        <View style={styles.chipRow}>
          {ACTIVITY_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              style={[styles.chip, form.activityLevel === level && styles.chipActive]}
              onPress={() => handleChange('activityLevel', level)}
            >
              <Text style={[styles.chipText, form.activityLevel === level && styles.chipTextActive]}>
                {level}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.half]}>
          <Text style={styles.label}>Sleep (hours/night)</Text>
          <TextInput
            style={[styles.input, fieldErrors.sleepHours && styles.inputError]}
            placeholder="e.g. 7"
            placeholderTextColor={Colors.textSecondary}
            value={form.sleepHours}
            onChangeText={(v) => handleChange('sleepHours', v)}
            keyboardType="numeric"
          />
          {fieldErrors.sleepHours && <Text style={styles.fieldError}>{fieldErrors.sleepHours}</Text>}
        </View>

        <View style={[styles.inputGroup, styles.half]}>
          <Text style={styles.label}>Stress Level (0-100)</Text>
          <TextInput
            style={[styles.input, fieldErrors.stressLevel && styles.inputError]}
            placeholder="e.g. 30"
            placeholderTextColor={Colors.textSecondary}
            value={form.stressLevel}
            onChangeText={(v) => handleChange('stressLevel', v)}
            keyboardType="number-pad"
          />
          {fieldErrors.stressLevel && (
            <Text style={styles.fieldError}>{fieldErrors.stressLevel}</Text>
          )}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Medical History</Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Smoker</Text>
        <Switch
          value={form.smoking}
          onValueChange={(v) => handleChange('smoking', v)}
          trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
          thumbColor={form.smoking ? Colors.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Diabetes</Text>
        <Switch
          value={form.diabetes}
          onValueChange={(v) => handleChange('diabetes', v)}
          trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
          thumbColor={form.diabetes ? Colors.primary : '#f4f3f4'}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Hypertension</Text>
        <Switch
          value={form.hypertension}
          onValueChange={(v) => handleChange('hypertension', v)}
          trackColor={{ false: Colors.border, true: Colors.primary + '60' }}
          thumbColor={form.hypertension ? Colors.primary : '#f4f3f4'}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Saving...' : submitLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.destructiveContainer,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.destructive,
    fontSize: FontSize.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  half: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.destructive,
  },
  fieldError: {
    color: Colors.destructive,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  segmentText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  segmentTextActive: {
    color: Colors.onPrimary,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.onPrimary,
    fontWeight: '600',
  },
  bmiBadge: {
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    alignSelf: 'flex-start',
  },
  bmiBadgeText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  switchLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
    ...Shadow.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: Colors.onPrimary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});

export default HealthProfileForm;
