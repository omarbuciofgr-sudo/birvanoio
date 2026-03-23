import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, Mail, Building2, MapPin } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"] & {
  lead_score?: number | null;
};
type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-status-new/20 text-status-new border-status-new/30" },
  contacted: { label: "Contacted", color: "bg-status-contacted/20 text-status-contacted border-status-contacted/30" },
  qualified: { label: "Qualified", color: "bg-status-qualified/20 text-status-qualified border-status-qualified/30" },
  converted: { label: "Converted", color: "bg-status-converted/20 text-status-converted border-status-converted/30" },
  lost: { label: "Lost", color: "bg-status-lost/20 text-status-lost border-status-lost/30" },
};

const statusOrder: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

interface LeadKanbanBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
  onLeadsUpdate: () => void;
}

interface KanbanCardProps {
  lead: Lead;
  onClick: () => void;
}

function KanbanCard({ lead, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 cursor-grab active:cursor-grabbing bg-card border-border hover:border-primary/50 transition-all"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="space-y-2">
        <div className="font-medium text-foreground text-sm line-clamp-1">
          {lead.business_name}
        </div>
        
        {lead.contact_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span className="line-clamp-1">{lead.contact_name}</span>
          </div>
        )}
        
        {(lead.city || lead.state) && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{[lead.city, lead.state].filter(Boolean).join(", ")}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 pt-1">
          {lead.phone && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
              <Phone className="w-2.5 h-2.5 mr-1" />
              Phone
            </Badge>
          )}
          {lead.email && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
              <Mail className="w-2.5 h-2.5 mr-1" />
              Email
            </Badge>
          )}
        </div>
        
        {lead.lead_score !== null && lead.lead_score !== undefined && (
          <div className="pt-1">
            <LeadScoreBadge leadId={lead.id} score={lead.lead_score} />
          </div>
        )}
      </div>
    </Card>
  );
}

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

function KanbanColumn({ status, leads, onLeadClick }: KanbanColumnProps) {
  const config = statusConfig[status];
  
  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border ${config.color}`}>
        <span className="font-medium text-sm">{config.label}</span>
        <Badge variant="secondary" className="text-xs">
          {leads.length}
        </Badge>
      </div>
      
      <div className="flex-1 bg-secondary/30 rounded-b-lg border border-t-0 border-border p-2 space-y-2 min-h-[400px] max-h-[calc(100vh-300px)] overflow-y-auto">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onClick={() => onLeadClick(lead)}
            />
          ))}
        </SortableContext>
        
        {leads.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No leads
          </div>
        )}
      </div>
    </div>
  );
}

export function LeadKanbanBoard({ leads, onLeadClick, onLeadsUpdate }: LeadKanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  const leadsByStatus = statusOrder.reduce((acc, status) => {
    acc[status] = leads.filter((lead) => lead.status === status);
    return acc;
  }, {} as Record<LeadStatus, Lead[]>);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const leadId = active.id as string;
    const overId = over.id as string;

    // Determine target status
    let targetStatus: LeadStatus | null = null;
    
    // Check if dropped over a column
    if (statusOrder.includes(overId as LeadStatus)) {
      targetStatus = overId as LeadStatus;
    } else {
      // Dropped over another lead - find its status
      const targetLead = leads.find((l) => l.id === overId);
      if (targetLead) {
        targetStatus = targetLead.status;
      }
    }

    if (!targetStatus) return;

    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === targetStatus) return;

    // Update the lead status
    const updates: Record<string, any> = { status: targetStatus };
    
    if (targetStatus === "contacted" && !lead.contacted_at) {
      updates.contacted_at = new Date().toISOString();
    }
    if (targetStatus === "converted" && !lead.converted_at) {
      updates.converted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", leadId);

    if (error) {
      toast.error("Failed to update lead status");
    } else {
      toast.success(`Lead moved to ${statusConfig[targetStatus].label}`);
      onLeadsUpdate();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statusOrder.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            leads={leadsByStatus[status]}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead && (
          <Card className="p-3 bg-card border-primary shadow-lg w-72">
            <div className="font-medium text-foreground text-sm">
              {activeLead.business_name}
            </div>
            {activeLead.contact_name && (
              <div className="text-xs text-muted-foreground mt-1">
                {activeLead.contact_name}
              </div>
            )}
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
