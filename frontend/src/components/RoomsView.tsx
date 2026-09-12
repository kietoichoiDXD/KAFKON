import React, { useState } from 'react';

export const RoomsView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [rooms, setRooms] = useState<string[]>([]);

  const handleCreateRoom = () => {
    if (roomName.trim()) {
      setRooms([...rooms, roomName.trim()]);
      setRoomName('');
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-[#f8faf9] flex flex-col">
      {/* Page Header */}
      <div className="h-14 px-8 border-b border-gray-200/80 bg-white/70 backdrop-blur flex items-center shrink-0">
        <h2 className="text-base font-semibold text-gray-800">Rooms</h2>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-start p-8 max-w-4xl mx-auto w-full">
        {/* Mascot */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-100 via-teal-50 to-emerald-100 border border-teal-200/60 flex items-center justify-center text-3xl shadow-sm mb-4">
          👾
        </div>

        {/* Hero Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight text-center mb-3">
          Ask once. Everyone reads the answer.
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-gray-500 text-center max-w-2xl leading-relaxed mb-6">
          One shared thread per topic, for your team and Anna. Ask in it and everyone reads the same
          answer. Long work keeps running in the background and its result lands in the room.
        </p>

        {/* CTA Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-2.5 rounded-full bg-[#008775] text-white text-sm font-medium hover:bg-[#007363] transition-all shadow-sm hover:shadow flex items-center gap-2 mb-12"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Create your first room</span>
        </button>

        {/* Existing Rooms List if created */}
        {rooms.length > 0 && (
          <div className="w-full mb-10 p-4 rounded-xl bg-white border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Active Rooms ({rooms.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {rooms.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/50 hover:bg-teal-50/40 hover:border-teal-200 transition-colors cursor-pointer"
                >
                  <span className="text-[#008775] font-bold text-base">#</span>
                  <span className="text-sm font-medium text-gray-800">{r}</span>
                  <span className="ml-auto text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How It Works Section */}
        <div className="w-full mb-14">
          <div className="text-center text-sm font-semibold text-gray-800 mb-8">How it works</div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 px-4">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-5 left-16 right-16 h-[1.5px] bg-gray-200 -z-0" />

            {/* Step 1 */}
            <div className="flex flex-col items-center text-center relative z-10 max-w-[200px]">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 font-bold mb-3 shadow-sm">
                #
              </div>
              <div className="text-sm font-semibold text-gray-800 mb-1">Name a room</div>
              <div className="text-xs text-gray-500 leading-normal">
                One topic, one name, like #incidents
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center relative z-10 max-w-[200px]">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-teal-500/40 flex items-center justify-center text-teal-600 mb-3 shadow-sm">
                <span className="material-symbols-outlined text-[19px]">auto_awesome</span>
              </div>
              <div className="text-sm font-semibold text-gray-800 mb-1">Ask in it</div>
              <div className="text-xs text-gray-500 leading-normal">Anna answers in the room</div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center relative z-10 max-w-[200px]">
              <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 mb-3 shadow-sm">
                <span className="material-symbols-outlined text-[18px]">link</span>
              </div>
              <div className="text-sm font-semibold text-gray-800 mb-1">Share the link</div>
              <div className="text-xs text-gray-500 leading-normal">
                Anyone in the workspace can join
              </div>
            </div>
          </div>
        </div>

        {/* Why Teams Use Rooms Section */}
        <div className="w-full">
          <div className="text-center text-sm font-semibold text-gray-800 mb-6">Why teams use rooms</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1 */}
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008775] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[19px]">forum</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Answers, not logs</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                The feed shows one message per answer. The work behind it opens beside the feed when
                you want to see it.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008775] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[19px]">density_medium</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Side threads</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Reply in thread to dig into one answer without taking the room off topic.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-sm flex flex-col">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#008775] flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[19px]">alternate_email</span>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Team and agents</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                @mention teammates and agents alike. The room shows who took part and what you have
                not read yet.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal create room */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Create a new Room</h3>
            <p className="text-xs text-gray-500 mb-4">
              Enter a name for the room (e.g. #governance, #incident-bridge, #cost-ops).
            </p>
            <div className="relative mb-4">
              <span className="absolute left-3 top-2.5 text-gray-400 font-bold">#</span>
              <input
                type="text"
                placeholder="room-topic"
                value={roomName}
                onChange={e => setRoomName(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#008775]"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRoom}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#008775] hover:bg-[#007363] rounded-lg"
              >
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
