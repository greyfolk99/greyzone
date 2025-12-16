#!/bin/bash

# Greyzone Feature Test Script
# Tests all CLI features and cleans up afterward

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI="node $SCRIPT_DIR/dist/cli/index.js"
PASSED=0
FAILED=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  Greyzone CLI Feature Test"
echo "=========================================="
echo ""

pass() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((FAILED++))
}

section() {
  echo ""
  echo -e "${YELLOW}=== $1 ===${NC}"
}

# ==========================================
# Test Functions
# ==========================================

test_build() {
  section "Build"
  if npm run build > /dev/null 2>&1; then
    pass "Build successful"
  else
    fail "Build failed"
    exit 1
  fi
}

test_init() {
  section "Init"

  # Create temp directory for init test
  TEMP_DIR=$(mktemp -d)
  cd "$TEMP_DIR"

  # Test init
  if $CLI init test_project > /dev/null 2>&1; then
    pass "gz init creates .greyzone"
  else
    fail "gz init"
  fi

  # Verify config exists
  if [ -f ".greyzone/config.yml" ]; then
    pass "config.yml created"
  else
    fail "config.yml created"
  fi

  # Test duplicate init fails
  if $CLI init test_project 2>&1 | grep -q "already exists"; then
    pass "duplicate init blocked"
  else
    fail "duplicate init blocked"
  fi

  # Cleanup
  cd - > /dev/null
  rm -rf "$TEMP_DIR"
}

test_set_get_delete() {
  section "Set/Get/Delete"

  # Set
  $CLI set TEST_KEY test_value -y > /dev/null 2>&1 && pass "set" || fail "set"

  # Get
  RESULT=$($CLI get TEST_KEY 2>&1)
  [ "$RESULT" = "test_value" ] && pass "get" || fail "get (got: $RESULT)"

  # Update
  $CLI set TEST_KEY updated_value -y > /dev/null 2>&1 && pass "update" || fail "update"
  RESULT=$($CLI get TEST_KEY 2>&1)
  [ "$RESULT" = "updated_value" ] && pass "get updated" || fail "get updated"

  # Delete
  $CLI delete TEST_KEY -y > /dev/null 2>&1 && pass "delete" || fail "delete"
  $CLI get TEST_KEY 2>&1 | grep -q "Key not found" && pass "verify deleted" || fail "verify deleted"
}

test_list() {
  section "List"

  $CLI set LIST_KEY1 value1 -y > /dev/null 2>&1
  $CLI set LIST_KEY2 value2 -y > /dev/null 2>&1

  RESULT=$($CLI list 2>&1)
  if echo "$RESULT" | grep -q "LIST_KEY1" && echo "$RESULT" | grep -q "LIST_KEY2"; then
    pass "list shows keys"
  else
    fail "list shows keys"
  fi

  # Cleanup
  $CLI delete LIST_KEY1 -y > /dev/null 2>&1
  $CLI delete LIST_KEY2 -y > /dev/null 2>&1
}

test_current() {
  section "Current"

  RESULT=$($CLI current 2>&1)
  echo "$RESULT" | grep -q "Project" && pass "current shows project" || fail "current shows project"

  RESULT=$($CLI current -g 2>&1)
  echo "$RESULT" | grep -q "Global" && pass "current -g shows global" || fail "current -g shows global"
}

test_profile() {
  section "Profile"

  # Set in profile
  $CLI set PROFILE_KEY profile_value --profile test_profile -y > /dev/null 2>&1 && pass "set --profile" || fail "set --profile"

  # Get from profile
  RESULT=$($CLI get PROFILE_KEY --profile test_profile 2>&1)
  [ "$RESULT" = "profile_value" ] && pass "get --profile" || fail "get --profile"

  # List shows profile
  RESULT=$($CLI current 2>&1)
  echo "$RESULT" | grep -q "test_profile" && pass "current shows profile" || fail "current shows profile"

  # Delete from profile
  $CLI delete PROFILE_KEY --profile test_profile -y > /dev/null 2>&1 && pass "delete --profile" || fail "delete --profile"

  # Cleanup
  rm -rf .greyzone/test_profile
}

test_global() {
  section "Global Scope"

  # Set global
  $CLI set GLOBAL_TEST_KEY global_value -g -y > /dev/null 2>&1 && pass "set -g" || fail "set -g"

  # Get global
  RESULT=$($CLI get GLOBAL_TEST_KEY -g 2>&1)
  [ "$RESULT" = "global_value" ] && pass "get -g" || fail "get -g"

  # List global
  RESULT=$($CLI list -g 2>&1)
  echo "$RESULT" | grep -q "GLOBAL_TEST_KEY" && pass "list -g" || fail "list -g"

  # Delete global
  $CLI delete GLOBAL_TEST_KEY -g -y > /dev/null 2>&1 && pass "delete -g" || fail "delete -g"
}

test_log() {
  section "Log/History"

  # Create some history
  $CLI set LOG_KEY value1 -y > /dev/null 2>&1
  $CLI set LOG_KEY value2 -y > /dev/null 2>&1

  # Log shows history
  RESULT=$($CLI log 2>&1)
  echo "$RESULT" | grep -q "set value" && pass "log shows history" || fail "log shows history"

  # Log with key filter
  RESULT=$($CLI log LOG_KEY 2>&1)
  echo "$RESULT" | grep -q "LOG_KEY" && pass "log <key> filters" || fail "log <key> filters"

  # Log --all
  $CLI set PROFILE_LOG profile_val --profile log_profile -y > /dev/null 2>&1
  RESULT=$($CLI log --all 2>&1)
  echo "$RESULT" | grep -q "\[" && pass "log --all shows profile prefix" || fail "log --all shows profile prefix"

  # Cleanup
  $CLI delete LOG_KEY -y > /dev/null 2>&1
  $CLI delete PROFILE_LOG --profile log_profile -y > /dev/null 2>&1
  rm -rf .greyzone/log_profile
}

test_undo_rollback() {
  section "Undo/Rollback"

  # Set value
  $CLI set UNDO_KEY original -y > /dev/null 2>&1

  # Undo
  $CLI undo -y > /dev/null 2>&1 && pass "undo" || fail "undo"
  $CLI get UNDO_KEY 2>&1 | grep -q "Key not found" && pass "undo removes key" || fail "undo removes key"

  # Set values for rollback
  $CLI set ROLLBACK_KEY v1 -y > /dev/null 2>&1
  sleep 1
  TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
  sleep 1
  $CLI set ROLLBACK_KEY v2 -y > /dev/null 2>&1

  # Rollback by steps (-y before -- to ensure it's parsed)
  $CLI rollback -y -- -1 > /dev/null 2>&1 && pass "rollback -1" || fail "rollback -1"

  # Cleanup
  $CLI delete ROLLBACK_KEY -y > /dev/null 2>&1
}

test_diff() {
  section "Diff"

  # Use UTC time to match DB timestamps
  DT1=$(date -u "+%Y-%m-%d %H:%M:%S")
  sleep 1
  $CLI set DIFF_KEY diff_value -y > /dev/null 2>&1
  sleep 1
  DT2=$(date -u "+%Y-%m-%d %H:%M:%S")

  RESULT=$($CLI diff "$DT1" "$DT2" 2>&1)
  echo "$RESULT" | grep -q "DIFF_KEY" && pass "diff shows changes" || fail "diff shows changes"

  # Cleanup
  $CLI delete DIFF_KEY -y > /dev/null 2>&1
}

test_import_export() {
  section "Import/Export"

  # Create test .env file
  echo "IMPORT_KEY1=import_value1" > /tmp/test_import.env
  echo "IMPORT_KEY2=import_value2" >> /tmp/test_import.env

  # Import
  $CLI import /tmp/test_import.env -y > /dev/null 2>&1 && pass "import" || fail "import"

  # Verify import
  RESULT=$($CLI get IMPORT_KEY1 2>&1)
  [ "$RESULT" = "import_value1" ] && pass "import values correct" || fail "import values correct"

  # Import with --keys
  echo "IMPORT_KEY3=value3" >> /tmp/test_import.env
  $CLI import /tmp/test_import.env -k IMPORT_KEY3 -y > /dev/null 2>&1 && pass "import -k" || fail "import -k"

  # Export
  RESULT=$($CLI export 2>&1)
  echo "$RESULT" | grep -q "export IMPORT_KEY1" && pass "export" || fail "export"

  # Export with --keys
  RESULT=$($CLI export -k IMPORT_KEY1 2>&1)
  if echo "$RESULT" | grep -q "IMPORT_KEY1" && ! echo "$RESULT" | grep -q "IMPORT_KEY2"; then
    pass "export -k filters"
  else
    fail "export -k filters"
  fi

  # Export to file
  $CLI export -o /tmp/test_export.env > /dev/null 2>&1
  [ -f /tmp/test_export.env ] && pass "export -o creates file" || fail "export -o creates file"

  # Cleanup
  rm -f /tmp/test_import.env /tmp/test_export.env
  $CLI delete IMPORT_KEY1 -y > /dev/null 2>&1
  $CLI delete IMPORT_KEY2 -y > /dev/null 2>&1
  $CLI delete IMPORT_KEY3 -y > /dev/null 2>&1
}

test_locked() {
  section "Locked (requires sudo)"

  # Set locked (requires sudo)
  sudo $CLI set LOCKED_KEY locked_secret --locked -y > /dev/null 2>&1 && pass "sudo set --locked" || fail "sudo set --locked"

  # Get locked (masked)
  RESULT=$($CLI get LOCKED_KEY --locked 2>&1)
  echo "$RESULT" | grep -q "lock" && pass "get --locked masked" || fail "get --locked masked"

  # Get via hierarchy (returns locked value)
  RESULT=$($CLI get LOCKED_KEY 2>&1)
  [ "$RESULT" = "locked_secret" ] && pass "get returns locked value" || fail "get returns locked value"

  # Try override locked (should fail)
  $CLI set LOCKED_KEY override -y 2>&1 | grep -q "locked" && pass "blocked override locked" || fail "blocked override locked"

  # Try set --locked without sudo (should fail)
  $CLI set LOCKED_KEY2 test --locked -y 2>&1 | grep -q "require" && pass "blocked set --locked without sudo" || fail "blocked set --locked without sudo"

  # Try delete --locked without sudo (should fail)
  $CLI delete LOCKED_KEY --locked -y 2>&1 | grep -q "require" && pass "blocked delete --locked without sudo" || fail "blocked delete --locked without sudo"

  # Log shows locked entries
  $CLI log 2>&1 | grep -q "locked" && pass "log shows locked" || fail "log shows locked"

  # Delete locked (requires sudo)
  sudo $CLI delete LOCKED_KEY --locked -y > /dev/null 2>&1 && pass "sudo delete --locked" || fail "sudo delete --locked"
}

test_github() {
  section "GitHub Config"

  # Set GitHub config
  $CLI github --account testuser --repo testowner/testrepo > /dev/null 2>&1 && pass "github --account --repo" || fail "github --account --repo"

  # Show GitHub config
  RESULT=$($CLI github 2>&1)
  echo "$RESULT" | grep -q "testuser" && pass "github shows config" || fail "github shows config"
}

test_confirmation() {
  section "Confirmation Prompts"

  # Set without -y should prompt (we can't test interactive, but we test -y works)
  $CLI set CONFIRM_KEY value -y > /dev/null 2>&1 && pass "set -y skips prompt" || fail "set -y skips prompt"
  $CLI delete CONFIRM_KEY -y > /dev/null 2>&1 && pass "delete -y skips prompt" || fail "delete -y skips prompt"
}

test_help() {
  section "Help"

  $CLI --help 2>&1 | grep -q "Environment variable manager" && pass "gz --help" || fail "gz --help"
  $CLI set --help 2>&1 | grep -q "Set an environment variable" && pass "gz set --help" || fail "gz set --help"
}

print_summary() {
  section "Summary"
  echo ""
  echo "=========================================="
  echo -e "  ${GREEN}Passed: $PASSED${NC}"
  echo -e "  ${RED}Failed: $FAILED${NC}"
  echo "=========================================="

  if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
  else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
  fi
}

# ==========================================
# Run All Tests
# ==========================================

cd "$SCRIPT_DIR"

test_build
test_init
test_set_get_delete
test_list
test_current
test_profile
test_global
test_log
test_undo_rollback
test_diff
test_import_export
test_locked
test_github
test_confirmation
test_help

print_summary
