import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, Calendar, CheckCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';

export const AssignmentContent = ({ sections, showToast }) => {
  const navigate = useNavigate();
  const { courseId } = useParams();

  // Extract all assignments from the classroom sections dynamically
  const assignments = sections 
    ? sections.flatMap(section => section.assignments || []) 
    : [];

  const handleAction = (task, status) => {
    if (status === 'late') {
      if (showToast) {
        showToast(`Tenggat tugas "${task.title}" telah berakhir. Silakan hubungi guru pengampu.`, 'error');
      }
    } else {
      navigate(`/assignment/${task.id}`, { state: { courseId } });
    }
  };

  return (
    <div className="space-y-4 text-left select-none">
      {assignments.map((task) => {
        // Status Badge Mapper
        const renderStatusBadge = () => {
          if (task.status === 'completed') {
            return (
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black rounded-md inline-flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                Selesai
              </span>
            );
          }
          if (task.status === 'late') {
            return (
              <span className="px-2 py-0.5 bg-red-50 border border-red-100 text-red-500 text-[10px] font-black rounded-md inline-flex items-center gap-1">
                Terlambat
              </span>
            );
          }
          return (
            <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-600 text-[10px] font-black rounded-md inline-flex items-center gap-1">
              Belum Dikerjakan
            </span>
          );
        };

        return (
          <div 
            key={task.id}
            className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5 min-w-0">
              {/* Task Icon Grid */}
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-[#7047EB] flex items-center justify-center shrink-0 shadow-inner">
                <ClipboardList className="w-5 h-5" />
              </div>
              
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs font-black text-slate-805 truncate" title={task.title}>
                    {task.title}
                  </h3>
                  {renderStatusBadge()}
                </div>
                
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Tenggat: {task.deadline}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
              <span className="text-[10px] font-black text-[#7047EB] bg-purple-100/60 px-2 py-0.5 rounded-md">
                +{task.xpReward} XP
              </span>
              <Button
                size="sm"
                onClick={() => handleAction(task, task.status)}
                className={`px-4 py-1.5 rounded-xl text-xs font-black select-none cursor-pointer border shadow-sm
                  ${task.status === 'completed'
                    ? 'bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-200/60'
                    : task.status === 'late'
                    ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-100'
                    : 'bg-[#7047EB] hover:bg-[#5E3BD2] text-white border-transparent'
                  }
                `}
              >
                {task.status === 'completed' ? 'Lihat Hasil' : task.status === 'late' ? 'Terlambat' : 'Kerjakan'}
              </Button>
            </div>

          </div>
        );
      })}
    </div>
  );
};

export default AssignmentContent;
