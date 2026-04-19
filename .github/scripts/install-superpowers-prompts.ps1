$ErrorActionPreference = 'Stop'

$installDir = Join-Path (Join-Path $HOME '.cache') 'superpowers'
$promptsDir = Join-Path (Join-Path $PWD '.github') 'prompts'

if (-not (Test-Path $installDir)) {
    throw "Superpowers cache not found at $installDir"
}

New-Item -ItemType Directory -Force -Path $promptsDir | Out-Null

$skills = @(
    @{ src = 'writing-plans'; cmd = 'write-plan'; desc = 'Create a detailed implementation plan (Superpowers)' },
    @{ src = 'executing-plans'; cmd = 'execute-plan'; desc = 'Execute an implementation plan with checkpoints' },
    @{ src = 'brainstorming'; cmd = 'brainstorm'; desc = 'Generate creative solutions and explore ideas' },
    @{ src = 'test-driven-development'; cmd = 'tdd'; desc = 'Implement code using strict TDD cycles' },
    @{ src = 'systematic-debugging'; cmd = 'investigate'; desc = 'Perform systematic root-cause analysis' },
    @{ src = 'verification-before-completion'; cmd = 'verify'; desc = 'Ensure fixes work before claiming success' },
    @{ src = 'using-git-worktrees'; cmd = 'worktree'; desc = 'Create isolated workspace for parallel development' },
    @{ src = 'finishing-a-development-branch'; cmd = 'finish-branch'; desc = 'Merge, PR, or discard completed work' },
    @{ src = 'requesting-code-review'; cmd = 'review'; desc = 'Request a self-correction code review' },
    @{ src = 'receiving-code-review'; cmd = 'receive-review'; desc = 'Respond to code review feedback' },
    @{ src = 'subagent-driven-development'; cmd = 'subagent-dev'; desc = 'Dispatch subagents for task-by-task development' },
    @{ src = 'dispatching-parallel-agents'; cmd = 'dispatch-agents'; desc = 'Run concurrent subagent workflows' },
    @{ src = 'writing-skills'; cmd = 'write-skill'; desc = 'Create new skills following TDD best practices' },
    @{ src = 'using-superpowers'; cmd = 'superpowers'; desc = 'Learn about the Superpowers capabilities' }
)

foreach ($skill in $skills) {
    $srcPath = Join-Path $installDir ("skills/{0}/SKILL.md" -f $skill.src)
    if (-not (Test-Path $srcPath)) {
        throw "Missing skill: $($skill.src)"
    }

    $destPath = Join-Path $promptsDir ("{0}.prompt.md" -f $skill.cmd)
    $body = Get-Content $srcPath -Raw
    $content = @(
        '---',
        "name: $($skill.cmd)",
        "description: $($skill.desc)",
        '---',
        '',
        "# Skill: $($skill.src)",
        $body
    )

    Set-Content -Path $destPath -Value $content
}

Write-Output "Installed $($skills.Count) Superpowers prompt files to $promptsDir"