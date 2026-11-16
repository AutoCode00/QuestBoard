// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title QuestBoard — community quest seasons with on-chain points.
/// @notice A project owner creates a season and quests, members submit proof, the owner approves or rejects.
///         AI review happens off-chain and only recommends: every point is added by the season owner's signature.
///         No tokens, no payments. Points are plain numbers; rewards are handled off-chain.
contract QuestBoard {
    struct Season {
        address owner;
        string name;
        string cid; // off-chain metadata (description, link, reward note) — IPFS cid or a short JSON string
        uint64 start;
        uint64 end;
    }

    struct Quest {
        uint256 seasonId;
        string title;
        uint16 points; // 10–500
        uint8 proofType; // 0 link · 1 text · 2 image link
        uint16 maxPerWallet; // 1–100
        uint32 completions; // approved submissions
        bool active;
    }

    /// @dev Input for addQuests (the other Quest fields are set by the contract).
    struct QuestInput {
        string title;
        uint16 points;
        uint8 proofType;
        uint16 maxPerWallet;
    }

    struct Submission {
        uint256 questId;
        address member;
        string proof;
        bytes32 proofHash;
        uint8 status; // 0 pending · 1 approved · 2 rejected
        uint64 at;
    }

    uint8 public constant PENDING = 0;
    uint8 public constant APPROVED = 1;
    uint8 public constant REJECTED = 2;
    uint256 public constant MAX_BATCH = 100;
    uint256 public constant MAX_QUESTS_PER_CALL = 20;
    uint256 public constant MAX_QUESTS_PER_SEASON = 60;

    Season[] private _seasons;
    Quest[] private _quests;
    Submission[] private _subs;

    mapping(uint256 => uint256[]) private _seasonQuests; // seasonId → questIds
    mapping(uint256 => uint256[]) private _seasonSubs; // seasonId → submissionIds
    mapping(address => uint256[]) private _ownerSeasons; // owner → seasonIds

    mapping(uint256 => mapping(address => uint32)) public seasonPoints;
    mapping(bytes32 => bool) public proofUsed;
    mapping(uint256 => address[]) private _seasonMembers; // wallets with at least one approved quest
    mapping(uint256 => mapping(address => bool)) private _isMember;

    mapping(uint256 => mapping(address => uint16)) public approvedCount; // questId → wallet → approved
    mapping(uint256 => mapping(address => bool)) public hasPending; // questId → wallet → one pending at a time

    uint256 public totalApproved;

    event SeasonCreated(uint256 indexed seasonId, address indexed owner, string name, uint64 start, uint64 end);
    event QuestAdded(uint256 indexed seasonId, uint256 indexed questId, string title, uint16 points);
    event QuestActive(uint256 indexed questId, bool active);
    event Submitted(uint256 indexed seasonId, uint256 indexed id, uint256 indexed questId, address member);
    event Reviewed(uint256 indexed id, bool approved, uint16 points);

    error BadInput();
    error NoSuchSeason();
    error NoSuchQuest();
    error NoSuchSubmission();
    error NotSeasonOwner();
    error SeasonClosed();
    error QuestInactive();
    error ProofUsed();
    error AlreadyPending();
    error LimitReached();
    error NotPending();

    // ---------------------------------------------------------------- owner

    function createSeason(string calldata name, string calldata cid, uint64 start, uint64 end) external returns (uint256 id) {
        uint256 n = bytes(name).length;
        if (n == 0 || n > 80 || bytes(cid).length > 600 || end <= start || end <= block.timestamp) revert BadInput();
        id = _seasons.length;
        _seasons.push(Season(msg.sender, name, cid, start, end));
        _ownerSeasons[msg.sender].push(id);
        emit SeasonCreated(id, msg.sender, name, start, end);
    }

    function addQuests(uint256 seasonId, QuestInput[] calldata qs) external returns (uint256 firstId) {
        Season storage s = _season(seasonId);
        if (s.owner != msg.sender) revert NotSeasonOwner();
        if (block.timestamp >= s.end) revert SeasonClosed();
        uint256 len = qs.length;
        if (len == 0 || len > MAX_QUESTS_PER_CALL || _seasonQuests[seasonId].length + len > MAX_QUESTS_PER_SEASON) revert BadInput();
        firstId = _quests.length;
        for (uint256 i; i < len; ++i) {
            QuestInput calldata q = qs[i];
            uint256 t = bytes(q.title).length;
            if (t == 0 || t > 200 || q.points < 10 || q.points > 500 || q.proofType > 2 || q.maxPerWallet == 0 || q.maxPerWallet > 100) revert BadInput();
            uint256 qid = _quests.length;
            _quests.push(Quest(seasonId, q.title, q.points, q.proofType, q.maxPerWallet, 0, true));
            _seasonQuests[seasonId].push(qid);
            emit QuestAdded(seasonId, qid, q.title, q.points);
        }
    }

    function setQuestActive(uint256 questId, bool active) external {
        Quest storage q = _quest(questId);
        if (_seasons[q.seasonId].owner != msg.sender) revert NotSeasonOwner();
        q.active = active;
        emit QuestActive(questId, active);
    }

    /// @notice Approve or reject pending submissions in one transaction (max 100). Approved → points are added.
    function review(uint256[] calldata ids, bool[] calldata approve) external {
        uint256 len = ids.length;
        if (len == 0 || len != approve.length || len > MAX_BATCH) revert BadInput();
        for (uint256 i; i < len; ++i) {
            if (ids[i] >= _subs.length) revert NoSuchSubmission();
            Submission storage sub = _subs[ids[i]];
            Quest storage q = _quests[sub.questId];
            uint256 sid = q.seasonId;
            if (_seasons[sid].owner != msg.sender) revert NotSeasonOwner();
            if (sub.status != PENDING) revert NotPending();
            hasPending[sub.questId][sub.member] = false;
            if (approve[i]) {
                sub.status = APPROVED;
                q.completions += 1;
                approvedCount[sub.questId][sub.member] += 1;
                seasonPoints[sid][sub.member] += q.points;
                if (!_isMember[sid][sub.member]) {
                    _isMember[sid][sub.member] = true;
                    _seasonMembers[sid].push(sub.member);
                }
                totalApproved += 1;
                emit Reviewed(ids[i], true, q.points);
            } else {
                sub.status = REJECTED;
                emit Reviewed(ids[i], false, 0);
            }
        }
    }

    // ---------------------------------------------------------------- member

    /// @notice Submit proof for a quest. The exact proof string is hashed: the app normalises links before sending.
    function submit(uint256 questId, string calldata proof) external returns (uint256 id) {
        Quest storage q = _quest(questId);
        Season storage s = _seasons[q.seasonId];
        if (block.timestamp < s.start || block.timestamp >= s.end) revert SeasonClosed();
        if (!q.active) revert QuestInactive();
        uint256 n = bytes(proof).length;
        if (n == 0 || n > 1000) revert BadInput();
        if (hasPending[questId][msg.sender]) revert AlreadyPending();
        if (approvedCount[questId][msg.sender] >= q.maxPerWallet) revert LimitReached();
        bytes32 h = keccak256(bytes(proof));
        if (proofUsed[h]) revert ProofUsed();
        proofUsed[h] = true;
        hasPending[questId][msg.sender] = true;
        id = _subs.length;
        _subs.push(Submission(questId, msg.sender, proof, h, PENDING, uint64(block.timestamp)));
        _seasonSubs[q.seasonId].push(id);
        emit Submitted(q.seasonId, id, questId, msg.sender);
    }

    // ---------------------------------------------------------------- views

    function getSeason(uint256 seasonId) external view returns (Season memory) {
        return _season(seasonId);
    }

    function seasonCount() external view returns (uint256) {
        return _seasons.length;
    }

    function questCount() external view returns (uint256) {
        return _quests.length;
    }

    function submissionCount() external view returns (uint256) {
        return _subs.length;
    }

    /// @notice Footer numbers: seasons, quests, approved proofs.
    function stats() external view returns (uint256 seasons, uint256 quests, uint256 approved) {
        return (_seasons.length, _quests.length, totalApproved);
    }

    function seasonsOf(address owner) external view returns (uint256[] memory) {
        return _ownerSeasons[owner];
    }

    function questsOf(uint256 seasonId) external view returns (uint256[] memory ids, Quest[] memory quests) {
        _season(seasonId);
        ids = _seasonQuests[seasonId];
        quests = new Quest[](ids.length);
        for (uint256 i; i < ids.length; ++i) quests[i] = _quests[ids[i]];
    }

    function getQuest(uint256 questId) external view returns (Quest memory) {
        return _quest(questId);
    }

    function getSubmission(uint256 id) external view returns (Submission memory) {
        if (id >= _subs.length) revert NoSuchSubmission();
        return _subs[id];
    }

    function seasonSubmissionCount(uint256 seasonId) external view returns (uint256) {
        return _seasonSubs[seasonId].length;
    }

    function submissionsOf(uint256 seasonId, uint256 from, uint256 count) external view returns (uint256[] memory ids, Submission[] memory subs) {
        _season(seasonId);
        uint256[] storage all = _seasonSubs[seasonId];
        uint256 end = from + count > all.length ? all.length : from + count;
        uint256 len = from >= end ? 0 : end - from;
        ids = new uint256[](len);
        subs = new Submission[](len);
        for (uint256 i; i < len; ++i) {
            ids[i] = all[from + i];
            subs[i] = _subs[ids[i]];
        }
    }

    function leaderboard(uint256 seasonId) external view returns (address[] memory members, uint32[] memory points) {
        _season(seasonId);
        members = _seasonMembers[seasonId];
        points = new uint32[](members.length);
        for (uint256 i; i < members.length; ++i) points[i] = seasonPoints[seasonId][members[i]];
    }

    function pointsOf(uint256 seasonId, address member) external view returns (uint32) {
        return seasonPoints[seasonId][member];
    }

    // ---------------------------------------------------------------- internal

    function _season(uint256 id) private view returns (Season storage) {
        if (id >= _seasons.length) revert NoSuchSeason();
        return _seasons[id];
    }

    function _quest(uint256 id) private view returns (Quest storage) {
        if (id >= _quests.length) revert NoSuchQuest();
        return _quests[id];
    }
}
