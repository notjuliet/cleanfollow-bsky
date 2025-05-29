export enum RepoStatus {
  BLOCKEDBY = 1 << 0, // 1
  BLOCKING = 1 << 1, // 2
  DELETED = 1 << 2, // 4
  DEACTIVATED = 1 << 3, // 8
  SUSPENDED = 1 << 4, // 16
  HIDDEN = 1 << 5, // 32
  YOURSELF = 1 << 6, // 64
}