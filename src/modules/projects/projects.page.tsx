import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import { DismissibleNotice } from '../../shared/components/dismissible-notice';

type ProjectRow = {
  id: number;
  name: string;
  active: boolean;
};

async function fetchProjects(): Promise<ProjectRow[]> {
  const response = await apiClient.get('/api/admin/projects');
  return response.data?.data || [];
}

async function createProject(input: { name: string; active: boolean }): Promise<void> {
  await apiClient.post('/api/admin/projects', input);
}

async function updateProject(input: { id: number; name?: string; active?: boolean }): Promise<void> {
  const { id, ...body } = input;
  await apiClient.patch(`/api/admin/projects/${id}`, body);
}

async function deleteProject(id: number): Promise<void> {
  await apiClient.delete(`/api/admin/projects/${id}`);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [pendingAction, setPendingAction] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: fetchProjects });
  const projects = useMemo(() => projectsQuery.data || [], [projectsQuery.data]);

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: async () => {
      setNotice('Project added.');
      setProjectName('');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: () => setNotice('Failed to add project.')
  });

  const toggleMutation = useMutation({
    mutationFn: updateProject,
    onSuccess: async () => {
      setNotice('Project updated.');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: async () => {
      setNotice('Project removed.');
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = projectName.trim();
    setPendingAction({
      title: 'Confirm Add Project',
      description: `Add project "${name}"?`,
      onConfirm: () => createMutation.mutate({ name, active: true })
    });
  };

  return (
    <section>
      <h2>Projects</h2>
      <p className="muted">HR can view, add, disable, and remove projects used in Slack project modal.</p>
      <DismissibleNotice message={notice} onClose={() => setNotice(null)} />

      <div className="grid-cards">
        <article className="card">
          <h3>Add Project</h3>
          <form onSubmit={onSubmit} className="action-row">
            <input
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              required
            />
            <button className="primary-btn" type="submit" disabled={createMutation.isPending}>
              Add
            </button>
          </form>
        </article>
      </div>

      <div className="card table-card">
        {projectsQuery.isLoading ? <p>Loading projects...</p> : null}
        {projectsQuery.isError ? <p>Could not load projects.</p> : null}

        {projects.length ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td>
                    {editingProjectId === project.id ? (
                      <div className="action-row">
                        <input
                          type="text"
                          value={editingProjectName}
                          onChange={(event) => setEditingProjectName(event.target.value)}
                        />
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() => {
                            const nextName = editingProjectName.trim();
                            if (!nextName) return;
                            toggleMutation.mutate({ id: project.id, name: nextName });
                            setEditingProjectId(null);
                            setEditingProjectName('');
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="chip-btn"
                          onClick={() => {
                            setEditingProjectId(null);
                            setEditingProjectName('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          navigate(`/analytics?projectId=${encodeURIComponent(String(project.id))}&month=${currentMonth()}`)
                        }
                      >
                        {project.name}
                      </button>
                    )}
                  </td>
                  <td>{project.active ? 'Yes' : 'No'}</td>
                  <td>
                    <div className="action-row">
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => {
                          setEditingProjectId(project.id);
                          setEditingProjectName(project.name);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() => toggleMutation.mutate({ id: project.id, active: !project.active })}
                      >
                        {project.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="chip-btn danger"
                        onClick={() =>
                          setPendingAction({
                            title: 'Confirm Remove Project',
                            description: `Remove project "${project.name}"?`,
                            onConfirm: () => deleteMutation.mutate(project.id)
                          })
                        }
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !projectsQuery.isLoading && <p>No projects found.</p>
        )}
      </div>

      {pendingAction ? (
        <div className="modal-backdrop" onClick={() => setPendingAction(null)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3>{pendingAction.title}</h3>
            <p className="muted">{pendingAction.description}</p>
            <div className="action-row">
              <button type="button" className="ghost-btn" onClick={() => setPendingAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  pendingAction.onConfirm();
                  setPendingAction(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
