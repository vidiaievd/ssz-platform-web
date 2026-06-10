// Public API for the teachers feature module
export type {
  Teacher,
  EmploymentType,
  TeacherStatus,
  HealthState,
  AvailabilityBlock,
  AvailabilityType,
  Absence,
  AbsenceKind,
  AbsenceScope,
  SubstituteRequest,
  SubRequestUrgency,
  SubRequestStatus,
  SubstituteCandidate,
  CandidateClass,
  CurriculumUnit,
  CurriculumPlan,
  UnitStatus,
  ForecastParams,
  ForecastResult,
  ForecastScenario,
  ForecastBaseline,
  Alert,
  AlertSeverity,
  AlertKind,
  AlertState,
  WorkloadKpis,
  TeacherLoadRow,
  Vacancy,
  RoomLoad,
} from './types';

export { teacherKeys } from './api/keys';

export {
  teacherAddSchema,
  availabilityBlockSchema,
  absenceReportSchema,
  subAssignSchema,
  forecastParamsSchema,
  curriculumUnitSchema,
} from './schemas';

export { useForecastScenarioStore } from './stores/forecast-scenario-store';
export { useSubstitutionUiStore } from './stores/substitution-ui-store';
