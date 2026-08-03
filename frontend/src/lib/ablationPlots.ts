export interface AblationPlot {
  id: string;
  title: string;
  file: string;
  finding: string;
  sayThis: string;
}

// Supplementary architecture-search / ablation plots, sourced from the
// standalone training experiments (see services/car-magnitude/app/data/plots/Graphs.txt).
// Separate from the live test-set metrics above -- these back up individual
// design decisions rather than overall model performance.
export const ABLATION_PLOTS: AblationPlot[] = [
  {
    id: 'pooling',
    title: 'Comparison of Pooling Methods',
    file: 'Architecture Search - Pooling Strategy.png',
    finding: "FinBERT's own built-in pooled summary won or tied every time, even against a learned attention mechanism.",
    sayThis:
      "We tested three ways to summarize the headline into one vector. The simplest one, the model's own built-in summary, performed best -- adding a fancier method didn't help.",
  },
  {
    id: 'head',
    title: 'Comparison of Prediction Heads',
    file: 'Architecture Search - Regression Head.png',
    finding: 'A simple 2-layer MLP head tied with a fancier gated-network (GRN) head.',
    sayThis:
      'We compared a simple prediction layer against a more sophisticated one with learned gating -- they performed the same, so we kept the simpler one.',
  },
  {
    id: 'mlp-sweep',
    title: 'MLP Width/Depth Architecture Sweep (3 Seeds)',
    file: 'MLP Width Depth Sweep.png',
    finding: 'A deeper network lowered RMSE but clearly hurt Spearman ranking ability -- a genuine trade-off, not a clean win.',
    sayThis:
      'A deeper network lowered our error metric but hurt its ability to rank news by importance -- since ranking ability is our core evidence, we kept the simpler design.',
  },
  {
    id: 'fusion',
    title: 'Architecture Search: Fusion Mechanism',
    file: 'Architecture Search - Fusion Mechanism.png',
    finding: 'Simple concatenation of text and numeric features tied with a smarter FiLM-based fusion.',
    sayThis:
      'We tested a more sophisticated way of blending text and numeric data -- it performed the same as simply combining them directly, so we kept the simpler approach.',
  },
  {
    id: 'freeze-depth',
    title: 'Architecture Search: Encoder Freeze Depth',
    file: 'Architecture Search - Encoder Freeze Depth.png',
    finding: 'Freezing 0, 4, 6, or 8 of FinBERT’s bottom layers performed equally well; freezing 6 trains 39% fewer parameters for the same result.',
    sayThis:
      'Freezing different amounts of the model made no real difference in accuracy -- so we chose the option that trains 39% fewer parameters, for efficiency, not because it scored higher.',
  },
  {
    id: 'volatility-window',
    title: 'Hyperparameter Sweep: Volatility Window',
    file: 'Hyperparameter Sweep - Volatility Window.png',
    finding: 'A 10-day volatility lookback was a clear, measured optimum among 2-60 day windows tested.',
    sayThis:
      'We tested seven different lookback windows for volatility and found 10 days was a real, measurable optimum -- not an assumption.',
  },
  {
    id: 'huber-delta',
    title: 'Hyperparameter Sweep: Huber Loss δ',
    file: 'Huber Loss δ Sweep.png',
    finding: "The default library δ=1.0 never engaged as an outlier cutoff at our data's scale; δ was recalculated from the data's actual spread.",
    sayThis:
      "We found the default setting for our loss function was essentially never engaging as designed for our data's scale, and fixed it by deriving the correct value directly from our data instead of trusting the default.",
  },
  {
    id: 'encoder-comparison',
    title: 'Encoder Comparison (3-Seed Evaluation)',
    file: 'Encoder Comparison.png',
    finding: 'FinBERT and general-purpose BERT-base were near-tied on error; FinBERT had a modest edge on ranking ability.',
    sayThis:
      'We compared our financial-specialized model against a generic one -- they were close, with the financial version showing a modest edge, suggesting domain-specific pretraining helps a little, not dramatically.',
  },
  {
    id: 'lora',
    title: 'Parameter-Efficient Fine-Tuning: Full vs LoRA',
    file: 'Parameter-Efficient Fine-Tuning (LoRA vs Full).png',
    finding: 'LoRA used 61x fewer trainable parameters and matched on error, but was clearly weaker on ranking ability.',
    sayThis:
      'We tested a resource-efficient training method that used 61 times fewer trainable parameters -- it matched our main model on raw error but was weaker at ranking, so we kept full fine-tuning, while showing the efficient option is a real, viable alternative.',
  },
  {
    id: 'sl-vocab',
    title: 'Sri Lankan Vocabulary Extension (Null Result)',
    file: 'SL Vocabulary Extension.png',
    finding: 'Adding the 8 most common Sri Lankan bank names as whole vocabulary tokens produced no measurable improvement.',
    sayThis:
      'We identified and fixed a real limitation -- the model fragmenting Sri Lankan company names -- but testing showed this specific fix didn’t measurably improve results, which we report honestly as a tested, negative finding rather than ignoring it.',
  },
  {
    id: 'final-performance',
    title: 'Final Model Performance Across 11 Independent Runs',
    file: 'FINAL Model Performance.png',
    finding: 'Spearman ranking correlation was positive in all 11 runs; PR-AUC beat random guessing by 44-51% consistently.',
    sayThis:
      'Because a single run can be misleading, we aggregated 11 independent training sessions. The result was consistent: a modest but real signal, present in every single run, and a 44 to 51 percent improvement over random chance at flagging significant news.',
  },
  {
    id: 'llm-zero-shot',
    title: 'LLM Zero-Shot vs FinBERT+MLP Model',
    file: 'LLM (Zero-Shot) vs Finbert+MLP Model.png',
    finding: "An off-the-shelf LLM's predictions barely varied per headline and had negative ranking correlation, versus our model's positive correlation.",
    sayThis:
      "We tested whether an off-the-shelf AI chatbot could already do this task. It could not -- its predictions barely varied per headline, and its ranking correlation was negative, meaning it wasn't actually reasoning about the specific news, while our fine-tuned model showed a genuine, consistent positive relationship.",
  },
];
